import jwt from "jsonwebtoken";

import User from "../models/userModel.js";
import {
  ACCOUNT_STATUSES,
} from "../constants/enums.js";

const extractToken = (req) => {
  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith("Bearer ")
  ) {
    return authorization.split(" ")[1];
  }

  return req.cookies?.jwt || null;
};

export const authenticate = async (
  req,
  res,
  next
) => {
  try {

 
    const token = extractToken(req);



    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "You must log in to access this resource.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
      console.log("decoded",decoded)
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message:
            "Your session has expired. Please log in again.",
        });
      }

      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    const currentUser =
      await User.findById(decoded.id);

      console.log(
  "Decoded ID:",
  decoded.id
);

console.log(
  "Found user:",
  currentUser
);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message:
          "The account associated with this token no longer exists.",
      });
    }

    if (
      currentUser.status ===
        ACCOUNT_STATUSES.PENDING ||
      currentUser.status ===
        ACCOUNT_STATUSES.SUSPENDED ||
      currentUser.status ===
        ACCOUNT_STATUSES.DEACTIVATED
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This account is not currently active.",
      });
    }

    req.user = currentUser;
    res.locals.user = currentUser;

    return next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};