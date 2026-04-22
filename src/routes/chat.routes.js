/**
 * chat.routes.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Chat API routes for the UniBazzar chatbot.
 *
 * Synchronous path  (legacy, kept for backwards compat):
 *   POST /api/chat         â†’ immediate AI response
 *
 * Async / queue-based path (production-ready):
 *   POST /api/chat/queue   â†’ enqueue message, returns jobId
 *   GET  /api/chat/status/:jobId â†’ poll job result
 */

import express from "express";
import {
  chatWithAssistant,
  addChatJobController,
  getJobStatusController,
} from "../controllers/chat.controller.js";
import { rateLimit } from "express-rate-limit";

const router = express.Router();

// â”€â”€ Stricter rate limit for the queue endpoint (prevents spam) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const chatRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 20, // max 20 queued requests per minute per IP
  message: {
    success: false,
    message:
      "Too many chat requests. Please wait a moment before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// (legacy) Synchronous: blocks until AI responds
/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send a synchronous chat message
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Show me cheap laptops"
 *     responses:
 *       200:
 *         description: Chat response returned
 */
router.post("/", chatWithAssistant);

// (async)  Enqueue a chatbot message â†’ responds immediately with { jobId }
/**
 * @swagger
 * /api/chat/queue:
 *   post:
 *     summary: Enqueue a chat message for async processing
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Find second-hand textbooks"
 *               userId:
 *                 type: string
 *                 example: "anonymous"
 *               priority:
 *                 type: number
 *                 example: 5
 *     responses:
 *       202:
 *         description: Job queued
 *       429:
 *         description: Too many requests
 */
router.post("/queue", chatRateLimit, addChatJobController);

// (async)  Poll the status and result of an enqueued job
/**
 * @swagger
 * /api/chat/status/{jobId}:
 *   get:
 *     summary: Get async chat job status/result
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status returned
 *       404:
 *         description: Job not found
 */
router.get("/status/:jobId", getJobStatusController);

export default router;
