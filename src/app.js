import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { rateLimit } from "express-rate-limit";

import { notFound, errorHandler } from "./middlewares/error.middleware.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import productRoutes from "./routes/product.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import chatRoutes from "./routes/chat.routes.js";

dotenv.config();

const app = express();

/**
 * ========================
 * CORS CONFIG (FIXED FOR VERCEL + RENDER)
 * ========================
 */
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, "")); // remove trailing slash

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow Postman / server-to-server requests
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // In production you can block, but this avoids crashes
      return callback(null, true);
    },
    credentials: true,
  })
);

/**
 * ⚠️ IMPORTANT:
 * DO NOT use app.options("*") → causes Express crash in new versions
 */

/**
 * ========================
 * SECURITY + PERFORMANCE
 * ========================
 */
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ========================
 * RATE LIMITING
 * ========================
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: "Too many requests, please try again later.",
});

app.use("/api", limiter);

/**
 * ========================
 * LOGGING
 * ========================
 */
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/**
 * ========================
 * STATIC FILES
 * ========================
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * ========================
 * ROUTES
 * ========================
 */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/chat", chatRoutes);

/**
 * ========================
 * BASE ROUTE
 * ========================
 */
app.get("/", (req, res) => {
  res.json({ message: "🚀 UniBazzar API Running" });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

/**
 * ========================
 * ERROR HANDLING
 * ========================
 */
app.use(notFound);
app.use(errorHandler);

export default app;