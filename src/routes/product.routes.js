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

router.get("/search", searchProducts);
router.get("/my", protect, getMyProducts);
router.get("/", getProducts);
router.get("/:id/similar", getSimilarProducts);
router.get("/:id", getProductById);
router.post("/:id/favorite", protect, toggleProductFavorite);
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
router.put(
  "/:id",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "photo", maxCount: 1 },
  ]),
  updateProduct,
);
router.patch(
  "/:id",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "photo", maxCount: 1 },
  ]),
  updateProduct,
);
router.delete("/:id", protect, deleteProduct);
router.post("/:id/reviews", protect, addProductReview);
router.put("/:id/reviews", protect, addProductReview);
router.delete("/reviews/:reviewId", protect, deleteProductReview);

export default router;
