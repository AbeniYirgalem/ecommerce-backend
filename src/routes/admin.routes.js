import express from 'express';
import { getUsers, getStats, updateListingStatus } from '../controllers/admin.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes here are protected and require 'campus_admin' role
router.use(protect, authorize('campus_admin'));

router.get('/users', getUsers);
router.get('/stats', getStats);
router.patch('/listings/:id/status', updateListingStatus);

export default router;
