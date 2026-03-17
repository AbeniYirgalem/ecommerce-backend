import Listing from "../models/Listing.model.js";

// @desc    Get all active listings
// @route   GET /api/listings
// @access  Public
export const getListings = async (req, res, next) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;

    // Filters
    const keyword = req.query.keyword
      ? {
          title: {
            $regex: req.query.keyword,
            $options: "i",
          },
        }
      : {};

    const category = req.query.category ? { category: req.query.category } : {};

    // Only fetch active listings
    const query = { ...keyword, ...category, status: "active" };

    const count = await Listing.countDocuments(query);
    const listings = await Listing.find(query)
      .populate("seller", "name email")
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      listings,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single listing
// @route   GET /api/listings/:id
// @access  Public
export const getListingById = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      "seller",
      "name email",
    );

    if (listing) {
      res.json(listing);
    } else {
      res.status(404).json({ message: "Listing not found" });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create new listing
// @route   POST /api/listings
// @access  Private
export const createListing = async (req, res, next) => {
  try {
    const { title, description, price, category, condition, tags } = req.body;

    const phoneNumber = req.body.phoneNumber || req.body.phone_number;
    const isValidPhone = (val) =>
      !val || /^\+?[0-9\s\-()]{7,20}$/.test(val.toString().trim());

    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const resolveFileUrl = (file) =>
      file?.secure_url || file?.path || file?.url || "";

    // Collect external URLs from the request body if they exist (support both imageUrls and images keys)
    const incomingUrls = (() => {
      const urls = [];
      if (req.body.images) {
        urls.push(
          ...(Array.isArray(req.body.images)
            ? req.body.images
            : [req.body.images]),
        );
      }
      if (req.body.imageUrls) {
        urls.push(
          ...(Array.isArray(req.body.imageUrls)
            ? req.body.imageUrls
            : [req.body.imageUrls]),
        );
      }
      return urls.filter(Boolean);
    })();

    // Collect uploaded files — handle both multer.single (req.file) and multer.array (req.files)
    const uploadedFiles = req.file ? [req.file] : req.files || [];
    const fileUrls = uploadedFiles
      .map((file) => resolveFileUrl(file))
      .filter(Boolean);

    // Consolidate images array and compute primary image
    const images = incomingUrls.length > 0 ? incomingUrls : fileUrls;
    const primaryImage =
      images[0] ||
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop";

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }
    if (!price || isNaN(Number(price))) {
      return res.status(400).json({ message: "A valid price is required" });
    }
    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const normalizedTags = Array.isArray(tags)
      ? tags.filter(Boolean).map((t) => t.toString().trim().toLowerCase())
      : tags
        ? [tags.toString().trim().toLowerCase()]
        : [];

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authenticated user required" });
    }

    const listing = new Listing({
      title,
      description,
      price: Number(price),
      category,
      condition: condition || "good",
      tags: normalizedTags,
      images: images.length ? images : [primaryImage],
      imageUrl: primaryImage, // legacy compatibility
      seller: req.user.id,
      phoneNumber: phoneNumber ? phoneNumber.toString().trim() : undefined,
    });

    const createdListing = await listing.save();
    const populated = await Listing.findById(createdListing._id).populate(
      "seller",
      "name email",
    );
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a listing
// @route   PUT /api/listings/:id
// @access  Private
export const updateListing = async (req, res, next) => {
  try {
    const { title, description, price, category, condition, status, tags } =
      req.body;

    const resolveFileUrl = (file) =>
      file?.secure_url || file?.path || file?.url || "";

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Only the seller can update
    if (listing.seller.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "User not authorized to update this listing" });
    }

    // Handle new images if provided (supports images or imageUrls, plus uploads)
    let updatedImages = Array.isArray(listing.images) ? listing.images : [];

    const incomingUrls = (() => {
      const urls = [];
      if (req.body.images !== undefined) {
        urls.push(
          ...(Array.isArray(req.body.images)
            ? req.body.images
            : req.body.images
              ? [req.body.images]
              : []),
        );
      }
      if (req.body.imageUrls !== undefined) {
        urls.push(
          ...(Array.isArray(req.body.imageUrls)
            ? req.body.imageUrls
            : req.body.imageUrls
              ? [req.body.imageUrls]
              : []),
        );
      }
      return urls.filter(Boolean);
    })();

    if (incomingUrls.length > 0) {
      updatedImages = incomingUrls;
    }

    if (req.files && req.files.length > 0) {
      const uploaded = req.files
        .map((file) => resolveFileUrl(file))
        .filter(Boolean);
      if (uploaded.length > 0) {
        updatedImages = uploaded;
      }
    }

    if (!updatedImages.length && listing.imageUrl) {
      updatedImages = [listing.imageUrl];
    }

    const primaryImage =
      updatedImages[0] || listing.imageUrl || "https://via.placeholder.com/300";

    listing.title = title || listing.title;
    listing.description = description || listing.description;
    listing.price = price || listing.price;
    listing.category = category || listing.category;
    listing.condition = condition || listing.condition;
    const normalizedTags = Array.isArray(tags)
      ? tags.filter(Boolean).map((t) => t.toString().trim().toLowerCase())
      : tags
        ? [tags.toString().trim().toLowerCase()]
        : listing.tags || [];

    listing.status = status || listing.status;
    listing.images = updatedImages.length
      ? updatedImages
      : listing.images && listing.images.length
        ? listing.images
        : [primaryImage];
    listing.imageUrl = primaryImage;
    listing.tags = normalizedTags;

    const updatedListing = await listing.save();
    const populated = await Listing.findById(updatedListing._id).populate(
      "seller",
      "name email",
    );
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a listing
// @route   DELETE /api/listings/:id
// @access  Private
export const deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (listing.seller.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "User not authorized to delete this listing" });
    }

    await listing.deleteOne();
    res.json({ message: "Listing removed" });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update a single review per user for a listing
// @route   POST/PUT /api/listings/:id/reviews (or /api/products/:id/reviews)
// @access  Private
export const addListingReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Check if user already reviewed
    const existingIndex = listing.reviews.findIndex(
      (r) => r.user.toString() === req.user.id.toString(),
    );

    if (existingIndex !== -1) {
      // Update existing review
      listing.reviews[existingIndex].rating = Number(rating);
      listing.reviews[existingIndex].comment = comment;
      listing.reviews[existingIndex].name =
        listing.reviews[existingIndex].name ||
        req.user.name ||
        "Anonymous User";

      await listing.save();
      const updated = listing.reviews[existingIndex];
      return res
        .status(200)
        .json({ message: "Review updated", review: updated });
    }

    const review = {
      user: req.user.id,
      name: req.user.name || "Anonymous User", // req.user.name comes from protect middleware
      rating: Number(rating),
      comment,
    };

    listing.reviews.push(review);
    await listing.save();

    res.status(201).json({ message: "Review added", review });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review (only by the review owner)
// @route   DELETE /api/reviews/:reviewId
// @access  Private
export const deleteListingReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const listing = await Listing.findOne({ "reviews._id": reviewId });

    if (!listing) {
      return res.status(404).json({ message: "Review not found" });
    }

    const review = listing.reviews.id(reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "User not authorized to delete this review" });
    }

    review.deleteOne();
    await listing.save();

    res.json({ message: "Review deleted" });
  } catch (error) {
    next(error);
  }
};
