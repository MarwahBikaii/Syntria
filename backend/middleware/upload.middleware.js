import multer from "multer";

import { AppError } from "../utils/app-error.js";

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(
      new AppError(
        `Unsupported file type: ${file.mimetype}.`,
        400
      )
    );
  }

  return callback(null, true);
};

export const uploadIssueMedia = multer({
  storage,
  fileFilter,
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
}).array("media", 5);