/**
 * Wraps an async Express route handler and automatically
 * forwards any rejected promise or thrown error to the
 * global error-handling middleware.
 */
export const asyncHandler = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};