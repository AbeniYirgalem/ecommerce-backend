import express from "express";
import { body } from "express-validator";
import {
  register,
  login,
  getMe,
  logout,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

// ── Register ──────────────────────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("name", "Name is required").notEmpty(),
    body("email", "Please include a valid email").isEmail(),
    body("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  validate,
  register,
);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email", "Please include a valid email").isEmail(),
    body("password", "Password is required").exists(),
  ],
  validate,
  login,
);

// ── Logout (clears cookie) ───────────────────────────────────────────────────
router.post("/logout", logout);

// ── Verify Email ────────────────────────────────────────────────────────────
router.get("/verify/:token", verifyEmail);

// ── Current user ──────────────────────────────────────────────────────────────
router.get("/me", protect, getMe);

export default router;
