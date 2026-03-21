import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpire: Date,

    // Profile fields
    avatar: {
      type: String,
      default: "",
    },
    // Legacy alias used by the frontend; keep in sync with `avatar`
    profile_picture: {
      type: String,
      default: "",
    },
    university: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      enum: ["student", "merchant", "tutor", "campus_admin"],
      default: "student",
    },
    favorites: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Listing",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Encrypt password using bcrypt
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and return a hashed verification token (stores hash on doc, returns raw)
const User = mongoose.model("User", userSchema);

export default User;
