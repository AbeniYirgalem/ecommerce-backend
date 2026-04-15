import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
import { startChatWorker, stopChatWorker } from "./workers/chatWorker.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const ENABLE_CHAT_WORKER = process.env.ENABLE_CHAT_WORKER !== "false";

/**
 * ========================
 * START SERVER
 * ========================
 */
connectDB()
  .then(() => {
    console.log("✅ MongoDB Connected");

    /**
     * Start Redis / BullMQ worker (optional)
     */
    if (ENABLE_CHAT_WORKER) {
      startChatWorker();
      console.log("✅ Chat worker started");
    } else {
      console.warn(
        "[server] Chat worker explicitly disabled (ENABLE_CHAT_WORKER=false)",
      );
    }

    /**
     * Start Express server
     */
    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
    });

    /**
     * ========================
     * GRACEFUL SHUTDOWN
     * ========================
     */
    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          if (ENABLE_CHAT_WORKER) {
            await stopChatWorker();
          }
        } catch (err) {
          console.error("Shutdown error:", err.message);
        }

        console.log("[server] Shutdown complete");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
