import mongoose from "mongoose";

import { AppError } from "../utils/app-error.js";

export const requireOrganization = (req, res, next) => {
  if (!req.user) {
    return next(
      new AppError("Authentication is required.", 401),
    );
  }

  if (!req.user.organization) {
    return next(
      new AppError(
        "Your account is not linked to an organization.",
        403,
      ),
    );
  }

  if (!mongoose.isValidObjectId(req.user.organization)) {
    return next(
      new AppError(
        "Your account has an invalid organization reference.",
        403,
      ),
    );
  }

  return next();
};