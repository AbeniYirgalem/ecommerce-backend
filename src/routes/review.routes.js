import express from 'express';
import { body } from 'express-validator';
import { createReview, getReviews } from '../controllers/review.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = express.Router();

router.post(
  '/',
  protect,
  [
    body('targetUserId', 'Target User ID is required').not().isEmpty(),
    body('rating', 'Rating is required, min 1, max 5').isNumeric({ min: 1, max: 5 }),
    body('comment', 'Comment is required').not().isEmpty(),
  ],
  validate,
  createReview
);

router.get('/:targetUserId', getReviews);

export default router;
