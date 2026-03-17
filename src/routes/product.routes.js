import express from "express";
import { body } from "express-validator";
import {
  getMerchantProducts,
  getStudentProducts,
  getTutorServices,
  getCategories,
  getProductById,
  searchProducts,
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

// --- MERCHANT PRODUCTS ---
router.get("/merchant-products", getMerchantProducts);
router.post(
  "/merchant-products",
  protect,
  upload.single("photo"),
  createProductAdapter,
  createListing,
);
router.get("/merchant-products/:id", getProductById);
router.put(
  "/merchant-products/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.patch(
  "/merchant-products/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.delete("/merchant-products/:id", protect, deleteListing);

// --- STUDENT PRODUCTS ---
router.get("/student-products", getStudentProducts);
router.post(
  "/student-products",
  protect,
  upload.single("photo"),
  createProductAdapter,
  createListing,
);
router.get("/student-products/:id", getProductById);
router.put(
  "/student-products/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.patch(
  "/student-products/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.delete("/student-products/:id", protect, deleteListing);

// --- TUTOR SERVICES ---
router.get("/tutor-services", getTutorServices);
router.post(
  "/tutor-services",
  protect,
  upload.single("photo"),
  createProductAdapter,
  createListing,
);
router.get("/tutor-services/:id", getProductById);
router.put(
  "/tutor-services/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.patch(
  "/tutor-services/:id",
  protect,
  upload.single("photo"),
  updateListing,
);
router.delete("/tutor-services/:id", protect, deleteListing);

router.get("/categories", getCategories);
router.get("/search", searchProducts);
router.get("/:id", getProductById);
router.post(
  "/",
  protect,
  upload.single("photo"),
  createProductAdapter,
  createListing,
);
router.post("/:id/reviews", protect, addListingReview);
router.put("/:id/reviews", protect, addListingReview);
router.delete("/reviews/:reviewId", protect, deleteListingReview);
// Support root as a fallback for getProducts
router.get("/", async (req, res, next) => {
  // By default, just fetch a mix or redirect to a specific one.
  // We'll treat this generically, perhaps fetch all listings.
  try {
    const { default: Listing } = await import("../models/Listing.model.js");
    const listings = await Listing.find({ status: "active" })
      .populate("seller", "name role")
      .limit(20)
      .sort({ createdAt: -1 });
    const products = listings.map((l) => ({ ...l.toObject(), id: l._id }));
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// Seed demo products (no auth required - safe public endpoint)
router.post("/seed-demo", seedDemoProducts);

export default router;
