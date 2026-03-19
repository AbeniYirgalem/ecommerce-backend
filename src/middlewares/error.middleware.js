// Friendly 404 handler
export const notFound = (_req, res) => {
  res.status(404).json({ success: false, message: "Item not found." });
};

// Centralized, user-friendly error handler
export const errorHandler = (err, req, res, _next) => {
  const rawStatus =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let statusCode = rawStatus;

  // Map common error types to friendly responses
  if (err.name === "ValidationError") {
    statusCode = 400;
  }

  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
  }

  if (err.code === 11000) {
    statusCode = 400;
  }

  const messageByStatus = {
    400: "Please fill all required fields correctly.",
    401: "Please log in to continue.",
    403: "You do not have permission to perform this action.",
    404: "Item not found.",
    429: "Too many requests. Please try again later.",
  };

  const message =
    messageByStatus[statusCode] || "Something went wrong. Please try again.";

  // Log full error for diagnostics without leaking details to the client
  console.error("[ErrorHandler]", err);

  res.status(statusCode).json({ success: false, message });
};
