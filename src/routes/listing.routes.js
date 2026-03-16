import express from 'express';
import { body } from 'express-validator';
import {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
} from '../controllers/listing.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = express.Router();

router
  .route('/')
  .get(getListings)
  .post(
    protect,
    upload.array('images', 5), // Max 5 images
    [
      body('title', 'Title is required').not().isEmpty(),
      body('description', 'Description is required').not().isEmpty(),
      body('price', 'Price is required and must be numeric').isNumeric(),
      body('category', 'Category is required').not().isEmpty(),
    ],
    validate,
    createListing
  );

router
  .route('/:id')
  .get(getListingById)
  .put(protect, upload.array('images', 5), updateListing)
  .delete(protect, deleteListing);

export default router;
