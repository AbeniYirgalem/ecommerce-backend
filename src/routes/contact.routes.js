import express from "express";
import { body } from "express-validator";
import { sendContactMessage } from "../controllers/contact.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
  "/",
  [
    body("name", "Name is required").trim().notEmpty(),
    body("email", "Please provide a valid email").trim().isEmail(),
    body("message", "Message is required")
      .trim()
      .isLength({ min: 1, max: 5000 }),
  ],
  validate,
  sendContactMessage,
);

export default router;
