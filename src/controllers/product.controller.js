import Listing from "../models/Listing.model.js";
import User from "../models/User.model.js";
import demoProducts from "../seeds/demoProducts.js";

const mapProduct = (p) => {
  const obj = p.toObject ? p.toObject() : p;
  const images =
    Array.isArray(obj.images) && obj.images.length
      ? obj.images
      : obj.imageUrl
        ? [obj.imageUrl]
        : [];
  return {
    ...obj,
    images,
    imageUrl: images[0] || obj.imageUrl,
    id: obj._id || p._id,
    phoneNumber: obj.phoneNumber || obj.phone_number,
  };
};

// Generic fetch with optional keyword/category filters
export const getProducts = async (req, res, next) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    const keyword = req.query.keyword
      ? { title: { $regex: req.query.keyword, $options: "i" } }
      : {};
    const categoryQuery = req.query.category
      ? { category: req.query.category }
      : {};
    const sellerQuery = req.query.seller ? { seller: req.query.seller } : {};

    const query = {
      ...keyword,
      ...categoryQuery,
      ...sellerQuery,
      status: "active",
    };

    const count = await Listing.countDocuments(query);
    const products = await Listing.find(query)
      .populate("seller", "name email")
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    const mappedProducts = products.map(mapProduct);

    res.json({
      products: mappedProducts,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products created by the authenticated user
// @route   GET /api/products/my
// @access  Private
export const getMyProducts = async (req, res, next) => {
  try {
    // Debug logs help trace auth context and query results
    console.log("[getMyProducts] user:", req.user?._id?.toString());

    const products = await Listing.find({ seller: req.user._id })
      .sort({ createdAt: -1 })
      .populate("seller", "name email");

    console.log("[getMyProducts] found:", products.length);

    res.json(products.map(mapProduct));
  } catch (error) {
    next(error);
  }
};

// @desc    Search products by keyword across title, description, tags
// @route   GET /api/products/search
export const searchProducts = async (req, res, next) => {
  try {
    const keyword = req.query.keyword || "";
    const regex = new RegExp(keyword, "i");

    const products = await Listing.find({
      status: "active",
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { tags: { $regex: regex } },
      ],
    })
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(products.map(mapProduct));
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single product (listing) by ID
// @route   GET /api/products/:id
export const getProductById = async (req, res, next) => {
  try {
    const product = await Listing.findById(req.params.id).populate(
      "seller",
      "name email",
    );
    if (product) {
      console.log("Product seller payload", product.seller);
      res.json(mapProduct(product));
    } else {
      res.status(404).json({ success: false, message: "Product not found." });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Adapter to map /api/products POST payloads to Listing creation
// @route   POST /api/products/*
export const createProductAdapter = async (req, _res, next) => {
  try {
    if (req.body.name) {
      req.body.title = req.body.name;
    } else if (req.body.description) {
      req.body.title = req.body.description.substring(0, 50) + "...";
    }

    if (!req.body.category && req.body.category_id) {
      req.body.category = req.body.category_id;
    }

    if (req.file && !req.files) {
      req.files = [req.file];
    }

    next();
  } catch (error) {
    next(error);
  }
};

// @desc    Seed demo products into the database
// @route   POST /api/products/seed-demo
// @access  Public (safe - only seeds if demo products don't exist)
export const seedDemoProducts = async (req, res, next) => {
  try {
    const existingCount = await Listing.countDocuments({ isDemo: true });
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `Demo products already exist (${existingCount} items). Skipping seed.`,
        count: existingCount,
        seeded: false,
      });
    }

    let demoUser = await User.findOne({ email: "demo@unibazzar.com" });
    if (!demoUser) {
      demoUser = await User.create({
        name: "UniBazzar Demo",
        email: "demo@unibazzar.com",
        password: "DemoPassword123!",
      });
    }

    const listingDocs = demoProducts.map((p) => ({
      ...p,
      seller: demoUser._id,
      status: "active",
    }));

    const inserted = await Listing.insertMany(listingDocs);

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${inserted.length} demo products!`,
      count: inserted.length,
      seeded: true,
    });
  } catch (error) {
    next(error);
  }
};
