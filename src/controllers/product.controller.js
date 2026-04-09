import Product from "../models/Product.model.js";

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
    favoritesCount: Array.isArray(obj.favorites) ? obj.favorites.length : 0,
  };
};

const getUploadedFiles = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    const images = Array.isArray(req.files.images) ? req.files.images : [];
    const photo = Array.isArray(req.files.photo) ? req.files.photo : [];
    return [...images, ...photo];
  }
  return [];
};

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

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("seller", "name email")
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      products: products.map(mapProduct),
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ seller: req.user._id })
      .sort({ createdAt: -1 })
      .populate("seller", "name email");

    res.json(products.map(mapProduct));
  } catch (error) {
    next(error);
  }
};

export const searchProducts = async (req, res, next) => {
  try {
    const keyword = req.query.keyword || "";
    const regex = new RegExp(keyword, "i");

    const products = await Product.find({
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

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "name email",
    );

    if (product) {
      res.json(mapProduct(product));
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    next(error);
  }
};

export const getSimilarProducts = async (req, res, next) => {
  try {
    const currentProduct = await Product.findById(req.params.id).select(
      "_id category tags",
    );

    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const categoryValue =
      typeof currentProduct.category === "string"
        ? currentProduct.category
        : currentProduct.category?.name || currentProduct.category?.title;

    const currentTags = Array.isArray(currentProduct.tags)
      ? currentProduct.tags.filter(Boolean)
      : [];

    const orConditions = [];
    if (categoryValue) {
      orConditions.push({ category: categoryValue });
    }
    if (currentTags.length > 0) {
      orConditions.push({ tags: { $in: currentTags } });
    }

    const query = {
      _id: { $ne: currentProduct._id },
      status: "active",
      ...(orConditions.length > 0 ? { $or: orConditions } : {}),
    };

    const similarProducts = await Product.find(query)
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({ products: similarProducts.map(mapProduct) });
  } catch (error) {
    next(error);
  }
};

export const toggleProductFavorite = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const userId = req.user.id;
    const alreadyFavorited = product.favorites.some(
      (favoriteId) => favoriteId.toString() === userId,
    );

    if (alreadyFavorited) {
      product.favorites = product.favorites.filter(
        (favoriteId) => favoriteId.toString() !== userId,
      );
    } else {
      product.favorites.push(userId);
    }

    const updatedProduct = await product.save();

    res.json({
      product: mapProduct(updatedProduct),
      favoritesCount: updatedProduct.favorites.length,
    });
  } catch (error) {
    next(error);
  }
};

export const createProductAdapter = async (req, _res, next) => {
  try {
    if (req.body.name) {
      req.body.title = req.body.name;
    } else if (req.body.description && !req.body.title) {
      req.body.title = req.body.description.substring(0, 50) + "...";
    }

    if (!req.body.category && req.body.category_id) {
      req.body.category = req.body.category_id;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
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

    const uploadedFiles = getUploadedFiles(req);
    const fileUrls = uploadedFiles
      .map((file) => resolveFileUrl(file))
      .filter(Boolean);

    const images = incomingUrls.length > 0 ? incomingUrls : fileUrls;
    const primaryImage =
      images[0] ||
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop";

    if (!title) return res.status(400).json({ message: "Title is required" });
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

    const product = new Product({
      title,
      description,
      price: Number(price),
      category,
      condition: condition || "good",
      tags: normalizedTags,
      images: images.length ? images : [primaryImage],
      imageUrl: primaryImage,
      seller: req.user._id,
      phoneNumber: phoneNumber ? phoneNumber.toString().trim() : undefined,
    });

    const createdProduct = await product.save();
    const populated = await Product.findById(createdProduct._id).populate(
      "seller",
      "name email",
    );

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { title, description, price, category, condition, status, tags } =
      req.body;

    const resolveFileUrl = (file) =>
      file?.secure_url || file?.path || file?.url || "";

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "User not authorized to update this product" });
    }

    let updatedImages = Array.isArray(product.images) ? product.images : [];

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

    const uploaded = getUploadedFiles(req)
      .map((file) => resolveFileUrl(file))
      .filter(Boolean);
    if (uploaded.length > 0) {
      updatedImages = uploaded;
    }

    if (!updatedImages.length && product.imageUrl) {
      updatedImages = [product.imageUrl];
    }

    const primaryImage =
      updatedImages[0] || product.imageUrl || "https://via.placeholder.com/300";

    product.title = title || product.title;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.condition = condition || product.condition;
    product.status = status || product.status;
    product.images = updatedImages.length
      ? updatedImages
      : product.images && product.images.length
        ? product.images
        : [primaryImage];
    product.imageUrl = primaryImage;
    product.tags = Array.isArray(tags)
      ? tags.filter(Boolean).map((t) => t.toString().trim().toLowerCase())
      : tags
        ? [tags.toString().trim().toLowerCase()]
        : product.tags || [];

    const updatedProduct = await product.save();
    const populated = await Product.findById(updatedProduct._id).populate(
      "seller",
      "name email",
    );

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "User not authorized to delete this product" });
    }

    await product.deleteOne();
    res.json({ message: "Product removed" });
  } catch (error) {
    next(error);
  }
};

export const addProductReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingIndex = product.reviews.findIndex(
      (r) => r.user.toString() === req.user.id.toString(),
    );

    if (existingIndex !== -1) {
      product.reviews[existingIndex].rating = Number(rating);
      product.reviews[existingIndex].comment = comment;
      product.reviews[existingIndex].name =
        product.reviews[existingIndex].name ||
        req.user.name ||
        "Anonymous User";

      await product.save();
      return res.status(200).json({
        message: "Review updated",
        review: product.reviews[existingIndex],
      });
    }

    const review = {
      user: req.user.id,
      name: req.user.name || "Anonymous User",
      rating: Number(rating),
      comment,
    };

    product.reviews.push(review);
    await product.save();

    res.status(201).json({ message: "Review added", review });
  } catch (error) {
    next(error);
  }
};

export const deleteProductReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const product = await Product.findOne({ "reviews._id": reviewId });

    if (!product) {
      return res.status(404).json({ message: "Review not found" });
    }

    const review = product.reviews.id(reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "User not authorized to delete this review" });
    }

    review.deleteOne();
    await product.save();

    res.json({ message: "Review deleted" });
  } catch (error) {
    next(error);
  }
};
