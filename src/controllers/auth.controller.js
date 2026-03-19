import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.model.js";
import sendEmail from "../utils/sendEmail.js";
import { verificationEmailTemplate } from "../utils/emailTemplates.js";

// ── Helper ────────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Generate verification token
    const verificationTokenRaw = crypto.randomBytes(32).toString("hex");
    const verificationTokenHashed = crypto
      .createHash("sha256")
      .update(verificationTokenRaw)
      .digest("hex");

    user.verificationToken = verificationTokenHashed;
    // 1 hour expiry
    user.verificationTokenExpire = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.CLIENT_URL?.replace(/\/$/, "") || "http://localhost:5173"}/verify/${verificationTokenRaw}`;

    // Send verification email (await to surface errors)
    await sendEmail({
      to: user.email,
      subject: "Verify your UniBazzar account",
      html: verificationEmailTemplate({ name: user.name, verificationUrl }),
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
