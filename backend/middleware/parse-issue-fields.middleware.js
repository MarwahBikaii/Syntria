import { AppError } from "../utils/app-error.js";

const parseJsonField = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "object" && value !== null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new AppError(
      `${fieldName} must be a valid JSON object.`,
      400,
    );
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(
      `${fieldName} must contain valid JSON.`,
      400,
    );
  }
};

export const parseIssueFields = (req, res, next) => {
  try {
    if (req.body.location !== undefined) {
      req.body.location = parseJsonField(
        req.body.location,
        "location",
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};