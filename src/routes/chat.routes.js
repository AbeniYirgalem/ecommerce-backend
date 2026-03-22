/**
 * chat.routes.js
 * ──────────────
 * Chat API routes for the UniBazzar chatbot.
 *
 * Synchronous path  (legacy, kept for backwards compat):
 *   POST /api/chat         → immediate AI response
 *
 * Async / queue-based path (production-ready):
 *   POST /api/chat/queue   → enqueue message, returns jobId
 *   GET  /api/chat/status/:jobId → poll job result
 */

import express from "express";
import {
  chatWithAssistant,
  addChatJobController,
  getJobStatusController,
} from "../controllers/chat.controller.js";
import { rateLimit } from "express-rate-limit";

const router = express.Router();

// ── Stricter rate limit for the queue endpoint (prevents spam) ────────────────
const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  limit: 20,                  // max 20 queued requests per minute per IP
  message: {
    success: false,
    message: "Too many chat requests. Please wait a moment before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ────────────────────────────────────────────────────────────────────

// (legacy) Synchronous: blocks until AI responds
router.post("/", chatWithAssistant);

// (async)  Enqueue a chatbot message → responds immediately with { jobId }
router.post("/queue", chatRateLimit, addChatJobController);

// (async)  Poll the status and result of an enqueued job
router.get("/status/:jobId", getJobStatusController);

export default router;

