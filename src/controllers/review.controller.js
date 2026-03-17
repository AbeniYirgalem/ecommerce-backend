import Review from '../models/Review.model.js';
import User from '../models/User.model.js';

// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res, next) => {
  try {
    const { targetUserId, rating, comment } = req.body;

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found to review' });
    }

    // Prevent self-review
    if (targetUserId.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    // Check if review already exists
    const alreadyReviewed = await Review.findOne({
      reviewer: req.user.id,
      targetUser: targetUserId,
    });

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this user' });
    }

    const review = await Review.create({
      rating: Number(rating),
      comment,
      reviewer: req.user.id,
      targetUser: targetUserId,
    });

    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a user
// @route   GET /api/reviews/:targetUserId
// @access  Public
export const getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ targetUser: req.params.targetUserId })
      .populate('reviewer', 'name avatar university role')
      .sort({ createdAt: -1 });

    if (!reviews) {
      return res.status(404).json({ message: 'Reviews not found' });
    }

    res.json(reviews);
  } catch (error) {
    next(error);
  }
};
