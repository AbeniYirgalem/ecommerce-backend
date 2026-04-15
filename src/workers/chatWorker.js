/**
 * chatWorker.js
 * -------------
 * BullMQ Worker that consumes jobs from the "chatbot-queue".
 *
 * Architecture overview:
 *   HTTP Request â†’ chatQueue (Redis) â†’ Worker (this file) â†’ aiService â†’ MongoDB
 *
 * The worker runs concurrently with the Express server in the same Node.js
 * process. For higher scale, it can be extracted to a separate process or
 * container â€” just import and call startChatWorker() from that entry point.
 *
 * Concurrency is controlled by CHAT_QUEUE_CONCURRENCY env variable (default 5).
 * In production, run multiple worker processes to scale horizontally.
 */

import { Worker } from "bullmq";
import { redisConnection } from "../queue/redisConnection.js";
import { processMessage } from "../services/aiService.js";
import ChatLog from "../models/ChatLog.model.js";

const QUEUE_NAME = "chatbot-queue";
const CONCURRENCY = parseInt(process.env.CHAT_QUEUE_CONCURRENCY || "5", 10);

// â”€â”€â”€ Cache helpers (in-memory TTL cache as lightweight deduplication) â”€â”€â”€â”€â”€â”€â”€â”€â”€
// For a production Redis cache, replace with ioredis.get / ioredis.setex calls.
const queryCache = new Map(); // key: normalized message â†’ { result, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getCachedResult = (message) => {
  const key = message.toLowerCase().trim();
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  queryCache.delete(key); // clean up expired
  return null;
};

const setCachedResult = (message, result) => {
  const key = message.toLowerCase().trim();
  queryCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
};

// Prune stale cache entries every 10 minutes to prevent memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of queryCache.entries()) {
      if (v.expiresAt <= now) queryCache.delete(k);
    }
  },
  10 * 60 * 1000,
);

// â”€â”€â”€ Job Processor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * processJob â€” the function BullMQ calls for each job.
 *
 * @param {import('bullmq').Job} job
 */
const processJob = async (job) => {
  const { userId = "anonymous", message = "" } = job.data || {};
  const logContext = `[chatWorker][job:${job.id}][user:${userId}]`;
  const startedAt = Date.now();

  try {
    const trimmed = String(message).trim();
    if (!trimmed) {
      throw new Error("Received empty message payload");
    }

    console.log(`${logContext} Started. Message: "${trimmed.slice(0, 80)}"`);

    await ChatLog.findOneAndUpdate(
      { jobId: String(job.id) },
      {
        userId,
        message: trimmed,
        status: "processing",
        attemptsMade: job.attemptsMade,
      },
      { upsert: true },
    );

    const cached = getCachedResult(trimmed);
    if (cached) {
      console.log(`${logContext} Cache hit. Returning cached result`);
      await ChatLog.findOneAndUpdate(
        { jobId: String(job.id) },
        {
          status: "completed",
          reply: cached.reply,
          type: cached.type,
          products: cached.products || [],
          priceBand: cached.priceBand || null,
          attemptsMade: job.attemptsMade,
          completedAt: new Date(),
        },
      );

      return cached;
    }

    const result = await processMessage(trimmed);
    setCachedResult(trimmed, result);

    await ChatLog.findOneAndUpdate(
      { jobId: String(job.id) },
      {
        status: "completed",
        reply: result.reply,
        type: result.type,
        products: result.products || [],
        priceBand: result.priceBand || null,
        errorMessage: null,
        attemptsMade: job.attemptsMade,
        completedAt: new Date(),
      },
    );

    console.log(
      `${logContext} Completed in ${Date.now() - startedAt}ms. Type: ${result?.type || "text"}`,
    );

    return result;
  } catch (err) {
    const failureReason =
      err?.message || "Chat processing failed due to an unknown worker error";

    console.error(
      `${logContext} Failed after ${Date.now() - startedAt}ms: ${failureReason}`,
    );

    await job
      .updateData({
        ...(job.data || {}),
        failureReason,
      })
      .catch((updateErr) => {
        console.error(
          `${logContext} Failed to persist failure reason on job data: ${updateErr.message}`,
        );
      });

    await ChatLog.findOneAndUpdate(
      { jobId: String(job.id) },
      {
        status: "failed",
        errorMessage: failureReason,
        attemptsMade: job.attemptsMade,
        completedAt: new Date(),
      },
      { upsert: true },
    ).catch((dbErr) => {
      console.error(
        `${logContext} Failed to persist failure in MongoDB: ${dbErr.message}`,
      );
    });

    throw new Error(failureReason);
  }
};

// â”€â”€â”€ Worker Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let workerInstance = null;

/**
 * startChatWorker â€” creates and starts the BullMQ Worker instance.
 * Call this once from server.js after the DB connection is established.
 */
export const startChatWorker = () => {
  if (workerInstance) {
    console.warn(
      "[chatWorker] Worker already running â€” skipping duplicate start",
    );
    return workerInstance;
  }

  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    // Automatically extend job lock if the AI call takes longer than expected
    lockDuration: 90_000, // 90 s lock
    lockRenewTime: 20_000, // Renew every 20 s
  });

  // â”€â”€ Event listeners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  workerInstance.on("completed", (job, result) => {
    console.log(
      `[chatWorker] Job ${job.id} completed. Type: ${result?.type || "text"} | attempts: ${job.attemptsMade}`,
    );
  });

  workerInstance.on("failed", async (job, err) => {
    const failureReason =
      err?.message ||
      job?.failedReason ||
      job?.data?.failureReason ||
      "Chat worker failed unexpectedly";

    console.error(
      `[chatWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${failureReason}`,
    );

    // Update DB record so polling endpoint can surface the failure
    if (job?.id) {
      await job
        .updateData({ ...(job.data || {}), failureReason })
        .catch(() => {});

      await ChatLog.findOneAndUpdate(
        { jobId: String(job.id) },
        {
          status: "failed",
          errorMessage: failureReason,
          attemptsMade: job.attemptsMade,
          completedAt: new Date(),
        },
        { upsert: true },
      ).catch((dbErr) =>
        console.error(
          "[chatWorker] DB update on failure failed:",
          dbErr.message,
        ),
      );
    }
  });

  workerInstance.on("stalled", (jobId) => {
    console.warn(
      `[chatWorker] âš ï¸  Job ${jobId} stalled â€” will be retried`,
    );
  });

  workerInstance.on("error", (err) => {
    console.error("[chatWorker] Worker error:", err.message);
  });

  console.log(
    `[chatWorker] ðŸš€ Worker started. Queue: "${QUEUE_NAME}" | Concurrency: ${CONCURRENCY}`,
  );

  return workerInstance;
};

/**
 * stopChatWorker â€” gracefully shuts down the worker.
 * Useful for graceful shutdown hooks (SIGTERM / SIGINT).
 */
export const stopChatWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log("[chatWorker] Worker stopped gracefully");
  }
};

export default { startChatWorker, stopChatWorker };
