/**
 * Custom application error.
 *
 * Used for expected (operational) errors such as:
 * - Validation failures
 * - Authentication errors
 * - Authorization errors
 * - Resource not found
 * - Business rule violations
 */
export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    details = null,
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request.", details = null) {
    return new AppError(message, 400, details);
  }

  static unauthorized(
    message = "Authentication is required.",
  ) {
    return new AppError(message, 401);
  }

  static forbidden(
    message = "You are not authorized to perform this action.",
  ) {
    return new AppError(message, 403);
  }

  static notFound(message = "Resource not found.") {
    return new AppError(message, 404);
  }

  static conflict(message = "Conflict.") {
    return new AppError(message, 409);
  }

  static unprocessable(
    message = "Unprocessable entity.",
    details = null,
  ) {
    return new AppError(message, 422, details);
  }

  static internal(
    message = "Internal server error.",
  ) {
    return new AppError(message, 500);
  }
}