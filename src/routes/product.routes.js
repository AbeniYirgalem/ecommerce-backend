import express from "express";
import { body } from "express-validator";
import {
  getProducts,
  getProductById,
  searchProducts,
  getMyProducts,
  createProductAdapter,
  seedDemoProducts,
} from "../controllers/product.controller.js";
import {
  createListing,
  updateListing,
  deleteListing,
  addListingReview,
  deleteListingReview,
} from "../controllers/listing.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get("/search", searchProducts);
router.get("/my", protect, getMyProducts);
router.get("/", getProducts);
router.get("/:id", getProductById);
router.post(
  "/",
  protect,
  upload.single("photo"),
  createProductAdapter,
  createListing,
);
router.put("/:id", protect, upload.single("photo"), updateListing);
router.patch("/:id", protect, upload.single("photo"), updateListing);
router.delete("/:id", protect, deleteListing);
router.post("/:id/reviews", protect, addListingReview);
router.put("/:id/reviews", protect, addListingReview);
router.delete("/reviews/:reviewId", protect, deleteListingReview);

// Seed demo products (no auth required - safe public endpoint)
router.post("/seed-demo", seedDemoProducts);

export default router;
