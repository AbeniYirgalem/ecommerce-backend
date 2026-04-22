import express from "express";
import { body } from "express-validator";
import { createReview, getReviews } from "../controllers/review.controller.js";
import { protectWithMessage } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create a review for a target user
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 example: "661f25c7f47a87a7f1a78123"
 *               rating:
 *                 type: number
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Great communication and smooth transaction."
 *     responses:
 *       201:
 *         description: Review created
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  protectWithMessage("Please log in to write a review"),
  [
    body("targetUserId", "Target User ID is required").not().isEmpty(),
    body("rating", "Rating is required, min 1, max 5").isNumeric({
      min: 1,
      max: 5,
    }),
    body("comment", "Comment is required").not().isEmpty(),
  ],
  validate,
  createReview,
);

/**
 * @swagger
 * /api/reviews/{targetUserId}:
 *   get:
 *     summary: Get reviews for a target user
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reviews returned
 */
router.get("/:targetUserId", getReviews);

export default router;
