import User from "../models/User.model.js";
import Product from "../models/Product.model.js";

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.university =
        req.body.university !== undefined
          ? req.body.university
          : user.university;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      const responseUser = updatedUser.toObject();
      responseUser.profile_picture =
        responseUser.avatar || responseUser.profile_picture || "";

      res.json(responseUser);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user avatar
// @route   PUT /api/users/avatar
// @access  Private
export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a file" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const imageUrl = req.file?.path || req.file?.secure_url;
    user.avatar = imageUrl;
    user.profile_picture = imageUrl;

    const savedUser = await user.save();
    const responseUser = savedUser.toObject();
    responseUser.profile_picture =
      responseUser.avatar || responseUser.profile_picture || "";

    res.json({
      message: "Avatar updated successfully",
      user: responseUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle favorite product
// @route   POST /api/users/favorites/:productId
// @access  Private
export const toggleFavorite = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.productId;

    if (!user) return res.status(404).json({ message: "User not found" });

    const isFavorited = user.favorites.includes(productId);

    if (isFavorited) {
      // Remove
      user.favorites = user.favorites.filter(
        (id) => id.toString() !== productId,
      );
    } else {
      // Add
      user.favorites.push(productId);
    }

    await user.save();
    res.json({ favorites: user.favorites });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products favorited by a user
// @route   GET /api/users/:id/favorites
// @access  Private
export const getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const products = await Product.find({ favorites: userId })
      .populate("seller", "name email")
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    next(error);
  }
};
