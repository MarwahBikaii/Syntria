const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (error, req, res, next) => {
  console.error(error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: Object.values(error.errors).map(
        (validationError) => ({
          field: validationError.path,
          message: validationError.message,
        })
      ),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${error.path}: ${error.value}`,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists.",
      fields: error.keyValue,
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message:
      error.message || "An unexpected server error occurred.",
  });
};

export {
  notFoundHandler,
  errorHandler,
};