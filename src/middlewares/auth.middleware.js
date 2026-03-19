import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

// Minimal cookie parser to avoid an extra dependency; returns an object of key/value pairs.
const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [key, ...v] = pair.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
};

const makeProtect = (unauthorizedMessage) => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies.token || null;

  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: unauthorizedMessage || "Please log in to continue.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: unauthorizedMessage || "Please log in to continue.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired, please log in again"
        : unauthorizedMessage || "Not authorized, token invalid";
    return res.status(401).json({ success: false, message });
  }
};

export const protect = makeProtect();
export const protectWithMessage = (message) => makeProtect(message);

// Roles are removed; this is now a passthrough for backward compatibility
export const authorize = () => (req, res, next) => next();
