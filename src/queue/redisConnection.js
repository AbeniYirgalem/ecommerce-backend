/**
 * redisConnection.js
 * ------------------
 * Shared ioredis connection instance for both the BullMQ Queue and Worker.
 * Using a single shared connection avoids duplicate Redis connections and
 * is the pattern recommended by BullMQ documentation.
 *
 * Usage: import { redisConnection } from './redisConnection.js'
 */

import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Create the shared Redis connection.
 * maxRetriesPerRequest: null is REQUIRED by BullMQ — it disables the default
 * retry limit so BullMQ can manage its own retry strategy.
 */
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Exponential back-off: 50ms, 100ms, 200ms … capped at 10 s
    return Math.min(times * 50, 10_000);
  },
});

redisConnection.on("connect", () =>
  console.log("[redis] Connected to Redis successfully"),
);

redisConnection.on("error", (err) =>
  console.error("[redis] Connection error:", err.message),
);

export default redisConnection;
