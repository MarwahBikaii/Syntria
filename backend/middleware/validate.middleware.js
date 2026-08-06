import { AppError } from "../utils/app-error.js";

export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new AppError(
          "Request validation failed.",
          400,
          errors,
        ),
      );
    }

    req.body = result.data;

    return next();
  };
};