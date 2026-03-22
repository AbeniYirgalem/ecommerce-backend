import app from './app.js';
import connectDB from './config/db.js';
import dotenv from 'dotenv';
import { startChatWorker, stopChatWorker } from './workers/chatWorker.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

/**
 * Bootstrap sequence:
 * 1. Connect to MongoDB
 * 2. Start the BullMQ chatbot worker (listens to Redis queue)
 * 3. Start the HTTP server
 */
connectDB()
  .then(() => {
    // Start the background worker so it's ready before the first request
    startChatWorker();

    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`,
      );
    });

    // ── Graceful shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} received — shutting down gracefully...`);
      // Stop accepting new HTTP requests
      server.close(async () => {
        // Drain the BullMQ worker (finish in-flight jobs, then stop)
        await stopChatWorker();
        console.log('[server] Shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch((error) => {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  });

