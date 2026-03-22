/**
 * chatWorker.js
 * -------------
 * BullMQ Worker that consumes jobs from the "chatbot-queue".
 *
 * Architecture overview:
 *   HTTP Request → chatQueue (Redis) → Worker (this file) → aiService → MongoDB
 *
 * The worker runs concurrently with the Express server in the same Node.js
 * process. For higher scale, it can be extracted to a separate process or
 * container — just import and call startChatWorker() from that entry point.
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

// ─── Cache helpers (in-memory TTL cache as lightweight deduplication) ─────────
// For a production Redis cache, replace with ioredis.get / ioredis.setex calls.
const queryCache = new Map(); // key: normalized message → { result, expiresAt }
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
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of queryCache.entries()) {
    if (v.expiresAt <= now) queryCache.delete(k);
  }
}, 10 * 60 * 1000);

// ─── Job Processor ────────────────────────────────────────────────────────────

/**
 * processJob — the function BullMQ calls for each job.
 *
 * @param {import('bullmq').Job} job
 */
const processJob = async (job) => {
  const { userId, message, timestamp } = job.data;
  const logContext = `[chatWorker][job:${job.id}][user:${userId}]`;

  console.log(`${logContext} Starting. Message: "${message.slice(0, 80)}"`);

  // ── 1. Mark the DB record as processing ───────────────────────────────────
  await ChatLog.findOneAndUpdate(
    { jobId: job.id },
    { status: "processing" },
  );

  // ── 2. Check cache for identical recent query ─────────────────────────────
  const cached = getCachedResult(message);
  if (cached) {
    console.log(`${logContext} Cache hit — returning cached result`);
    await ChatLog.findOneAndUpdate(
      { jobId: job.id },
      {
        status: "completed",
        reply: cached.reply,
        type: cached.type,
        products: cached.products || [],
        priceBand: cached.priceBand || null,
        completedAt: new Date(),
      },
    );
    return cached; // BullMQ stores this as job.returnvalue
  }

  // ── 3. Call the AI service ────────────────────────────────────────────────
  const result = await processMessage(message);
  console.log(`${logContext} AI processed. Type: ${result.type}`);

  // ── 4. Cache the result ───────────────────────────────────────────────────
  setCachedResult(message, result);

  // ── 5. Persist to MongoDB ─────────────────────────────────────────────────
  await ChatLog.findOneAndUpdate(
    { jobId: job.id },
    {
      status: "completed",
      reply: result.reply,
      type: result.type,
      products: result.products || [],
      priceBand: result.priceBand || null,
      completedAt: new Date(),
    },
  );

  console.log(`${logContext} Completed successfully`);
  return result; // BullMQ serialises this into job.returnvalue in Redis
};

// ─── Worker Lifecycle ─────────────────────────────────────────────────────────

let workerInstance = null;

/**
 * startChatWorker — creates and starts the BullMQ Worker instance.
 * Call this once from server.js after the DB connection is established.
 */
export const startChatWorker = () => {
  if (workerInstance) {
    console.warn("[chatWorker] Worker already running — skipping duplicate start");
    return workerInstance;
  }

  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    // Automatically extend job lock if the AI call takes longer than expected
    lockDuration: 60_000, // 60 s lock
    lockRenewTime: 20_000, // Renew every 20 s
  });

  // ── Event listeners ─────────────────────────────────────────────────────────

  workerInstance.on("completed", (job, result) => {
    console.log(`[chatWorker] ✅ Job ${job.id} completed. Type: ${result?.type}`);
  });

  workerInstance.on("failed", async (job, err) => {
    console.error(
      `[chatWorker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );
    // Update DB record so polling endpoint can surface the failure
    if (job?.id) {
      await ChatLog.findOneAndUpdate(
        { jobId: job.id },
        {
          status: "failed",
          errorMessage: err.message,
          completedAt: new Date(),
        },
      ).catch((dbErr) =>
        console.error("[chatWorker] DB update on failure failed:", dbErr.message),
      );
    }
  });

  workerInstance.on("stalled", (jobId) => {
    console.warn(`[chatWorker] ⚠️  Job ${jobId} stalled — will be retried`);
  });

  workerInstance.on("error", (err) => {
    console.error("[chatWorker] Worker error:", err.message);
  });

  console.log(
    `[chatWorker] 🚀 Worker started. Queue: "${QUEUE_NAME}" | Concurrency: ${CONCURRENCY}`,
  );

  return workerInstance;
};

/**
 * stopChatWorker — gracefully shuts down the worker.
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
