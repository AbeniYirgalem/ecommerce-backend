import User from '../models/User.model.js';
import Listing from '../models/Listing.model.js';

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getStats = async (req, res, next) => {
  try {
    const userCount = await User.countDocuments({});
    const listingCount = await Listing.countDocuments({});
    const activeListingCount = await Listing.countDocuments({ status: 'active' });

    res.json({
      users: userCount,
      totalListings: listingCount,
      activeListings: activeListingCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update listing status
// @route   PATCH /api/admin/listings/:id/status
// @access  Private/Admin
export const updateListingStatus = async (req, res, next) => {
    try {
      const { status } = req.body;
      const listing = await Listing.findById(req.params.id);
  
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }
  
      listing.status = status;
      await listing.save();
  
      res.json({ message: `Listing status updated to ${status}` });
    } catch (error) {
      next(error);
    }
  };
