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
 * Shared across the application — import this wherever you need to add jobs.
 */
export const chatQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: "exponential",
      delay: 2000, // Start at 2 s, then 4 s, then 8 s
    },
    removeOnComplete: {
      age: 3600,  // Keep completed jobs for 1 hour (for status polling)
      count: 500, // Keep at most 500 completed jobs
    },
    removeOnFail: {
      age: 86_400, // Keep failed jobs for 24 hours for debugging
    },
  },
});

/**
 * addChatJob — convenience wrapper that adds a structured job to the queue.
 *
 * @param {string} userId   - The user's ID (or "anonymous")
 * @param {string} message  - The raw user message text
 * @param {object} [opts]   - Optional BullMQ job options (e.g. { priority: 1 })
 * @returns {Promise<Job>}  - The created BullMQ Job object (contains job.id)
 */
export const addChatJob = async (userId, message, opts = {}) => {
  const job = await chatQueue.add(
    "process-chat-message", // Job name (shows in BullMQ dashboards)
    {
      userId,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    },
    opts,
  );

  console.log(
    `[chatQueue] Job ${job.id} added for user ${userId} | message: "${message.slice(0, 60)}..."`,
  );

  return job;
};

export default chatQueue;
