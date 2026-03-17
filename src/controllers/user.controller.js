import User from '../models/User.model.js';

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.university = req.body.university !== undefined ? req.body.university : user.university;
      
      // Allow role updates (e.g., student -> tutor)
      if (req.body.role && ['student', 'merchant', 'tutor', 'campus_admin'].includes(req.body.role)) {
        user.role = req.body.role;
      }
      
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        university: updatedUser.university,
        avatar: updatedUser.avatar,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
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
      return res.status(400).json({ message: 'Please upload a file' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Replace backslashes for windows paths to normalize URL
    const imageUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    user.avatar = imageUrl;

    await user.save();

    res.json({ avatar: user.avatar, message: 'Avatar updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle favorite listing
// @route   POST /api/users/favorites/:listingId
// @access  Private
export const toggleFavorite = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const listingId = req.params.listingId;

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isFavorited = user.favorites.includes(listingId);

    if (isFavorited) {
      // Remove
      user.favorites = user.favorites.filter(id => id.toString() !== listingId);
    } else {
      // Add
      user.favorites.push(listingId);
    }

    await user.save();
    res.json({ favorites: user.favorites });
  } catch (error) {
    next(error);
  }
};
