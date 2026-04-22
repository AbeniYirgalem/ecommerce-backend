import express from "express";
import { body } from "express-validator";
import { sendContactMessage } from "../controllers/contact.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Send a contact message
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Abenezer"
 *               email:
 *                 type: string
 *                 example: "abenezer@example.com"
 *               message:
 *                 type: string
 *                 example: "Hi, I need help with my account settings."
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 */
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
