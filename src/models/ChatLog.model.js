/**
 * ChatLog.model.js
 * ----------------
 * Mongoose schema for persisting chatbot interactions.
 *
 * Each document represents one user message + the AI response produced by
 * the background worker. The `jobId` field links back to the BullMQ job so
 * the status endpoint can serve results even after BullMQ cleans up its job.
 */

import mongoose from "mongoose";

const chatLogSchema = new mongoose.Schema(
  {
    /** BullMQ job ID — used for status lookups */
    jobId: {
      type: String,
      index: true,
    },

    /** User sending the message — "anonymous" for unauthenticated users */
    userId: {
      type: String,
      default: "anonymous",
      index: true,
    },

    /** The raw message the user sent */
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    /** Lifecycle status of this chat request */
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },

    /** The AI reply text */
    reply: {
      type: String,
      default: null,
    },

    /** Response type: 'text' | 'rag' | 'help' */
    type: {
      type: String,
      enum: ["text", "rag", "help", null],
      default: null,
    },

    /** Product listings included in a RAG response */
    products: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    /** Price band of the response: 'cheap' | 'mid' | 'expensive' */
    priceBand: {
      type: String,
      default: null,
    },

    /** Error message if processing failed */
    errorMessage: {
      type: String,
      default: null,
    },

    /** When the worker finished processing */
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

// Compound index for efficient user history queries
chatLogSchema.index({ userId: 1, createdAt: -1 });

const ChatLog = mongoose.model("ChatLog", chatLogSchema);

export default ChatLog;
