import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.model.js";
import sendEmail from "../utils/sendEmail.js";
import {
  resetPasswordEmailTemplate,
  verificationEmailTemplate,
} from "../utils/emailTemplates.js";

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });

const VERIFICATION_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_PASSWORD_RESEND_COOLDOWN_MS = 60 * 1000;
const DEFAULT_FRONTEND_URL = "https://ecommerce-frontend-six-vert.vercel.app";

const createVerificationTokenRaw = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getFrontendBaseUrl = () => {
  const isDev = process.env.NODE_ENV !== "production";
  const devUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL;
  const prodUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
  const selected = (isDev ? devUrl : prodUrl) || DEFAULT_FRONTEND_URL;
  return selected.trim().replace(/\/$/, "");
};

const buildVerificationUrl = (verificationTokenRaw) => {
  const frontendUrl = getFrontendBaseUrl();
  return `${frontendUrl}/verify/${verificationTokenRaw}`;
};

const buildResetPasswordUrl = (resetTokenRaw) => {
  const frontendUrl = getFrontendBaseUrl();
  return `${frontendUrl}/reset-password?token=${resetTokenRaw}`;
};

const queueVerificationEmail = ({ email, name, verificationUrl }) => {
  setImmediate(async () => {
    try {
      await sendEmail({
        to: email,
        subject: "Verify your UniBazzar account",
        html: verificationEmailTemplate({ name, verificationUrl }),
      });
    } catch (error) {
      console.error("Failed to send verification email:", error.message);
    }
  });
};

const queueResetPasswordEmail = ({ email, name, resetUrl }) => {
  setImmediate(async () => {
    try {
      await sendEmail({
        to: email,
        subject: "Reset your UniBazzar password",
        html: resetPasswordEmailTemplate({ name, resetUrl }),
      });
    } catch (error) {
      console.error("Failed to send reset password email:", error.message);
    }
  });
};

const issueVerificationForUser = async (user) => {
  const verificationTokenRaw = createVerificationTokenRaw();
  user.verificationToken = hashToken(verificationTokenRaw);
  user.verificationTokenExpire = Date.now() + VERIFICATION_TOKEN_TTL_MS;
  user.verificationEmailSentAt = new Date();
  await user.save({ validateBeforeSave: false });
  return verificationTokenRaw;
};

const createResetTokenRaw = () => crypto.randomBytes(32).toString("hex");

const issueResetTokenForUser = async (user) => {
  const resetTokenRaw = createResetTokenRaw();
  user.resetPasswordToken = hashToken(resetTokenRaw);
  user.resetPasswordExpire = Date.now() + RESET_PASSWORD_TOKEN_TTL_MS;
  user.resetPasswordEmailSentAt = new Date();
  await user.save({ validateBeforeSave: false });
  return resetTokenRaw;
};

const handleUnverifiedExistingUser = async (user, res) => {
  const sentAt = user.verificationEmailSentAt
    ? new Date(user.verificationEmailSentAt).getTime()
    : 0;
  const withinCooldown = Date.now() - sentAt < VERIFICATION_RESEND_COOLDOWN_MS;

  if (!withinCooldown) {
    const verificationTokenRaw = await issueVerificationForUser(user);
    const verificationUrl = buildVerificationUrl(verificationTokenRaw);
    queueVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl,
    });
  }

  return res.status(200).json({
    message:
      "Account already registered but not verified. Please check your email to verify your account.",
    email: user.email,
    alreadyRegistered: true,
    verificationEmailQueued: !withinCooldown,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Please provide a valid email" });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      if (userExists.isVerified) {
        return res.status(409).json({ message: "User already exists" });
      }

      return await handleUnverifiedExistingUser(userExists, res);
    }

    let user;
    try {
      user = await User.create({ name, email: normalizedEmail, password });
    } catch (error) {
      if (error?.code === 11000) {
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser && !existingUser.isVerified) {
          return await handleUnverifiedExistingUser(existingUser, res);
        }

        return res.status(409).json({ message: "User already exists" });
      }

      throw error;
    }

    const verificationTokenRaw = await issueVerificationForUser(user);
    const verificationUrl = buildVerificationUrl(verificationTokenRaw);
    queueVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl,
    });

    // Do NOT log in automatically; require verification first
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      message:
        "Registration successful. Please verify your email before logging in.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Email not verified. Please check your inbox." });
    }

    const token = generateToken(user._id);

    // Set httpOnly cookie to support cookie-based auth alongside the Authorization header
    const cookieLifespanDays = parseInt(
      process.env.JWT_COOKIE_EXPIRE_DAYS || "30",
      10,
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: cookieLifespanDays * 24 * 60 * 60 * 1000,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const responseUser = user.toObject();
    responseUser.profile_picture =
      responseUser.avatar || responseUser.profile_picture || "";
    res.status(200).json(responseUser);
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const tokenHashed = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      verificationToken: tokenHashed,
      verificationTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error", error);
    next(error);
  }
};

// @desc    Send reset password email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Please provide a valid email" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      const sentAt = user.resetPasswordEmailSentAt
        ? new Date(user.resetPasswordEmailSentAt).getTime()
        : 0;
      const withinCooldown =
        Date.now() - sentAt < RESET_PASSWORD_RESEND_COOLDOWN_MS;

      if (!withinCooldown) {
        const resetTokenRaw = await issueResetTokenForUser(user);
        const resetUrl = buildResetPasswordUrl(resetTokenRaw);
        queueResetPasswordEmail({
          email: user.email,
          name: user.name,
          resetUrl,
        });
      }
    }

    return res.status(200).json({
      message:
        "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const tokenRaw = String(req.params.token || "").trim();
    const newPassword = String(req.body.password || "");

    if (!tokenRaw) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!newPassword) {
      return res.status(400).json({ message: "Password is required" });
    }

    const tokenHashed = hashToken(tokenRaw);
    const user = await User.findOne({
      resetPasswordToken: tokenHashed,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordEmailSentAt = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear auth cookie (for clients that rely on cookies)
// @route   POST /api/auth/logout
// @access  Public (client may not have a valid token when it chooses to log out)
export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(200).json({ message: "Logged out" });
};
