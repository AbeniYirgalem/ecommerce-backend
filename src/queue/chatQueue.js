/**
 * chatQueue.js
 * ------------
 * Defines the BullMQ Queue for chatbot messages.
 *
 * Every time a user sends a chat message via POST /api/chat/queue, we add
 * a job here instead of processing it synchronously in the HTTP request.
 * This decouples the HTTP layer from the slow AI API call, preventing
 * server timeouts and overload under heavy traffic.
 *
 * Queue name: "chatbot-queue"
 * Storage:    Redis (via ioredis)
 */

import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection.js";

const QUEUE_NAME = "chatbot-queue";

/**
 * The BullMQ queue instance.
 * Shared across the application â€” import this wherever you need to add jobs.
 */
export const chatQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    timeout: 60_000, // Hard timeout per job (60 s)
    backoff: {
      type: "exponential",
      delay: 2000, // Start at 2 s, then 4 s, then 8 s
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour (for status polling)
      count: 500, // Keep at most 500 completed jobs
    },
    removeOnFail: {
      age: 86_400, // Keep failed jobs for 24 hours for debugging
    },
  },
});

/**
 * addChatJob â€” convenience wrapper that adds a structured job to the queue.
 *
 * @param {object|string} payloadOrUserId - payload object or legacy userId argument
 * @param {string} [legacyMessage]        - legacy message argument
 * @param {object|number} [legacyOpts]    - legacy options or priority
 * @returns {Promise<Job>}  - The created BullMQ Job object (contains job.id)
 */
export const addChatJob = async (
  payloadOrUserId,
  legacyMessage,
  legacyOpts = {},
) => {
  let userId = "anonymous";
  let message = "";
  let opts = {};

  // New style: addChatJob({ userId, message, priority, ...opts })
  if (
    payloadOrUserId &&
    typeof payloadOrUserId === "object" &&
    !Array.isArray(payloadOrUserId)
  ) {
    userId = payloadOrUserId.userId || "anonymous";
    message = payloadOrUserId.message || "";
    opts = { ...payloadOrUserId };
    delete opts.userId;
    delete opts.message;
  } else {
    // Legacy style: addChatJob(userId, message, opts)
    userId = payloadOrUserId || "anonymous";
    message = legacyMessage || "";
    opts =
      typeof legacyOpts === "number"
        ? { priority: legacyOpts }
        : { ...(legacyOpts || {}) };
  }

  const trimmedMessage = String(message).trim();
  if (!trimmedMessage) {
    throw new Error("Cannot enqueue an empty chat message");
  }

  const priority = Number.isFinite(Number(opts.priority))
    ? Number(opts.priority)
    : 5;

  delete opts.priority;

  const job = await chatQueue.add(
    "process-chat-message", // Job name (shows in BullMQ dashboards)
    {
      userId,
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
    },
    {
      priority,
      ...opts,
    },
  );

  console.log(
    `[chatQueue] Job ${job.id} added for user ${userId} | priority: ${priority} | message: "${trimmedMessage.slice(0, 60)}..."`,
  );

  return job;
};

export default chatQueue;
