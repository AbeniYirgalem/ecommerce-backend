import express from 'express';
import { updateProfile, updateAvatar, toggleFavorite } from '../controllers/user.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { getMeUser } from '../controllers/profile.controller.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.put('/avatar', protect, upload.single('avatar'), updateAvatar);
router.post('/favorites/:listingId', protect, toggleFavorite);

// Alias for frontend expectation
router.get('/me/', protect, getMeUser);
router.patch('/me/', protect, updateProfile); // Frontend uses PATCH to update role

export default router;
