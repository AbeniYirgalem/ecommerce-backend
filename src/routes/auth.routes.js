import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  getMe,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = express.Router();

// ── Register ──────────────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  validate,
  register
);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
  ],
  validate,
  login
);

// ── Current user ──────────────────────────────────────────────────────────────
router.get('/me', protect, getMe);

// ── Email Verification ────────────────────────────────────────────────────────
router.get('/verify-email/:token', verifyEmail);

// ── Password Reset ────────────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email', 'Please include a valid email').isEmail()],
  validate,
  forgotPassword
);

router.post(
  '/reset-password/:token',
  [
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('confirmPassword', 'Confirm password is required').not().isEmpty(),
  ],
  validate,
  resetPassword
);

export default router;
