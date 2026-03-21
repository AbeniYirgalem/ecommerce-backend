import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
    },
    category: {
      type: String,
      required: [true, "Please specify a category"],
      enum: [
        "Textbooks",
        "Electronics",
        "Clothes",
        "Stationery",
        "Dormitory",
        "Other",
      ],
    },
    condition: {
      type: String,
      enum: [
        "new",
        "like-new",
        "good",
        "fair",
        "used",
        "used_like_new",
        "used_good",
        "used_fair",
      ],
      default: "good",
    },
    tags: {
      type: [String],
      default: [],
      set: (vals) =>
        Array.isArray(vals)
          ? vals.filter(Boolean).map((t) => t.toString().trim().toLowerCase())
          : [],
    },
    images: {
      type: [String],
      default: [],
    },
    // Deprecated: kept for backward compatibility with older data/clients
    imageUrl: {
      type: String,
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => {
          if (!v) return true; // optional for backward compatibility
          return /^\+?[0-9\s\-()]{7,20}$/.test(v);
        },
        message: "Please provide a valid phone number",
      },
    },
    reviews: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          name: { type: String, required: true },
          comment: String,
          rating: Number,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "sold", "pending", "rejected"],
      default: "active",
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
