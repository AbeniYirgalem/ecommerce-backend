import express from "express";
import {
  updateProfile,
  updateAvatar,
  toggleFavorite,
  getUserFavorites,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { getMeUser } from "../controllers/profile.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update authenticated user profile
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Abenezer Y"
 *               university:
 *                 type: string
 *                 example: "Addis Ababa University"
 *               password:
 *                 type: string
 *                 example: "NewStrongPass123"
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.put("/profile", protect, updateProfile);

/**
 * @swagger
 * /api/users/avatar:
 *   put:
 *     summary: Update authenticated user avatar
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Avatar updated
 *       401:
 *         description: Unauthorized
 */
router.put("/avatar", protect, upload.single("avatar"), updateAvatar);

/**
 * @swagger
 * /api/users/favorites/{productId}:
 *   post:
 *     summary: Toggle favorite product for authenticated user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *             example: {}
 *     responses:
 *       200:
 *         description: Favorite status toggled
 *       401:
 *         description: Unauthorized
 */
router.post("/favorites/:productId", protect, toggleFavorite);

/**
 * @swagger
 * /api/users/{id}/favorites:
 *   get:
 *     summary: Get a user's favorite products
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorites returned
 *       401:
 *         description: Unauthorized
 */
router.get("/:id/favorites", protect, getUserFavorites);

// Alias for frontend expectation
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get authenticated user profile alias
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Current user profile returned
 *       401:
 *         description: Unauthorized
 */
router.get("/me/", protect, getMeUser);

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Partially update authenticated user profile alias
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Abenezer Y"
 *               university:
 *                 type: string
 *                 example: "Addis Ababa University"
 *               password:
 *                 type: string
 *                 example: "NewStrongPass123"
 *     responses:
 *       200:
 *         description: Current user profile updated
 *       401:
 *         description: Unauthorized
 */
router.patch("/me/", protect, updateProfile); // Frontend uses PATCH to update role

export default router;
