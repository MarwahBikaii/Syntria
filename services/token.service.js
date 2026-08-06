import crypto from "crypto";
import jwt from "jsonwebtoken";

import { AppError } from "../utils/app-error.js";

const requireEnvironmentVariable = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from the environment variables.`,
    );
  }

  return value;
};

const getAccessSecret = () =>
  requireEnvironmentVariable("JWT_ACCESS_SECRET");

const getRefreshSecret = () =>
  requireEnvironmentVariable("JWT_REFRESH_SECRET");

export const createAccessToken = (user) => {
  return jwt.sign(
    {
      role: user.role,
    },
    getAccessSecret(),
    {
      subject: user._id.toString(),
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      issuer: "syntria-api",
      audience: "syntria-client",
      algorithm: "HS256",
    },
  );
};

export const createRefreshToken = (user) => {
  return jwt.sign(
    {
      tokenType: "refresh",
    },
    getRefreshSecret(),
    {
      subject: user._id.toString(),
      expiresIn:
        process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      issuer: "syntria-api",
      audience: "syntria-client",
      algorithm: "HS256",
    },
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, getAccessSecret(), {
      issuer: "syntria-api",
      audience: "syntria-client",
      algorithms: ["HS256"],
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError(
        "Your access token has expired.",
        401,
      );
    }

    throw new AppError("Invalid access token.", 401);
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(
      token,
      getRefreshSecret(),
      {
        issuer: "syntria-api",
        audience: "syntria-client",
        algorithms: ["HS256"],
      },
    );

    if (payload.tokenType !== "refresh") {
      throw new AppError("Invalid refresh token.", 401);
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "TokenExpiredError") {
      throw new AppError(
        "Your session has expired. Please log in again.",
        401,
      );
    }

    throw new AppError("Invalid refresh token.", 401);
  }
};

export const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};