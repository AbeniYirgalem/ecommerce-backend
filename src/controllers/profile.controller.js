import User from "../models/User.model.js";

// @desc    Get current user (alias for frontend expected route)
// @route   GET /api/users/me/
// @access  Private
export const getMeUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const responseUser = user?.toObject();
    if (responseUser) {
      responseUser.profile_picture =
        responseUser.avatar || responseUser.profile_picture || "";
    }
    res.status(200).json(responseUser);
  } catch (error) {
    next(error);
  }
};
