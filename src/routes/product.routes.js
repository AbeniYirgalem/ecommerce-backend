import express from "express";
import { body } from "express-validator";
import {
  getProducts,
  getProductById,
  getSimilarProducts,
  toggleProductFavorite,
  searchProducts,
  getMyProducts,
  createProductAdapter,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductReview,
  deleteProductReview,
} from "../controllers/product.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Search products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Matching products returned
 */
router.get("/search", searchProducts);

/**
 * @swagger
 * /api/products/my:
 *   get:
 *     summary: Get authenticated user's products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: User products returned
 *       401:
 *         description: Unauthorized
 */
router.get("/my", protect, getMyProducts);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Products returned
 */
router.get("/", getProducts);

/**
 * @swagger
 * /api/products/{id}/similar:
 *   get:
 *     summary: Get similar products by product id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Similar products returned
 */
router.get("/:id/similar", getSimilarProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product returned
 *       404:
 *         description: Product not found
 */
router.get("/:id", getProductById);

/**
 * @swagger
 * /api/products/{id}/favorite:
 *   post:
 *     summary: Toggle favorite status for a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Favorite status updated
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/favorite", protect, toggleProductFavorite);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Dell Latitude 5400"
 *               description:
 *                 type: string
 *                 example: "Used laptop in good condition with charger included"
 *               price:
 *                 type: number
 *                 example: 18500
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *               condition:
 *                 type: string
 *                 example: "good"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["laptop", "dell", "student"]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://example.com/image1.jpg"]
 *               phoneNumber:
 *                 type: string
 *                 example: "+251911223344"
 *     responses:
 *       201:
 *         description: Product created
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "photo", maxCount: 1 },
  ]),
  createProductAdapter,
  [
    body("title", "Title is required").not().isEmpty(),
    body("description", "Description is required").not().isEmpty(),
    body("price", "Price is required and must be numeric").isNumeric(),
    body("category", "Category is required").not().isEmpty(),
  ],
  validate,
  createProduct,
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Replace/update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Dell Latitude 5400"
 *               description:
 *                 type: string
 *                 example: "Updated description for this listing"
 *               price:
 *                 type: number
 *                 example: 17500
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *               condition:
 *                 type: string
 *                 example: "like-new"
 *               status:
 *                 type: string
 *                 example: "active"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["laptop", "updated"]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://example.com/new-image.jpg"]
 *     responses:
 *       200:
 *         description: Product updated
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/:id",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "photo", maxCount: 1 },
  ]),
  updateProduct,
);

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Partially update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Dell Latitude 5400"
 *               description:
 *                 type: string
 *                 example: "Partially updated description"
 *               price:
 *                 type: number
 *                 example: 17000
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *               condition:
 *                 type: string
 *                 example: "good"
 *               status:
 *                 type: string
 *                 example: "active"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["laptop", "budget"]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://example.com/patch-image.jpg"]
 *     responses:
 *       200:
 *         description: Product updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:id",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "photo", maxCount: 1 },
  ]),
  updateProduct,
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", protect, deleteProduct);

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   post:
 *     summary: Add a review to a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Excellent quality and fast response from seller."
 *     responses:
 *       201:
 *         description: Review added
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/reviews", protect, addProductReview);

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   put:
 *     summary: Update a product review
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 example: 4
 *               comment:
 *                 type: string
 *                 example: "Updated review after one week of use."
 *     responses:
 *       200:
 *         description: Review updated
 *       401:
 *         description: Unauthorized
 */
router.put("/:id/reviews", protect, addProductReview);

/**
 * @swagger
 * /api/products/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a product review by review id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted
 *       401:
 *         description: Unauthorized
 */
router.delete("/reviews/:reviewId", protect, deleteProductReview);

export default router;
