import { v2 as cloudinary } from "cloudinary";

import { AppError } from "../utils/app-error.js";

const requiredEnvironmentVariables = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const variableName of requiredEnvironmentVariables) {
  if (!process.env[variableName]) {
    throw new Error(
      `${variableName} is missing from the environment variables.`,
    );
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload one Multer memory-storage file to Cloudinary.
 */
const uploadBuffer = ({
  buffer,
  folder,
  resourceType = "auto",
}) => {
  if (!buffer) {
    return Promise.reject(
      AppError.badRequest("The uploaded file buffer is missing."),
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          return reject(
            new AppError(
              `Cloudinary upload failed: ${error.message}`,
              502,
            ),
          );
        }

        if (!result) {
          return reject(
            new AppError(
              "Cloudinary did not return an upload result.",
              502,
            ),
          );
        }

        return resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
};

/**
 * Upload issue media files.
 *
 * Expected input:
 * req.files from Multer memoryStorage().
 */
export const uploadFilesToCloudinary = async (
  files = [],
  uploadedBy,
) => {
  if (!Array.isArray(files)) {
    throw AppError.badRequest("files must be an array.");
  }

  if (files.length === 0) {
    return [];
  }

  if (!uploadedBy) {
    throw AppError.badRequest(
      "uploadedBy is required when uploading media.",
    );
  }

  const uploadedAssets = [];

  try {
    for (const file of files) {
      const result = await uploadBuffer({
        buffer: file.buffer,
        folder: "syntria/issues",
        resourceType: "auto",
      });

      uploadedAssets.push({
        url: result.secure_url,
        publicId: result.public_id,
        mediaType:
          result.resource_type === "video"
            ? "video"
            : result.resource_type === "raw"
              ? "document"
              : "image",
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        evidenceType: "supporting",
        uploadedBy,
        uploadedAt: new Date(),
      });
    }

    return uploadedAssets;
  } catch (error) {
    /*
     * Roll back already-uploaded assets when one upload fails.
     */
    if (uploadedAssets.length > 0) {
      await deleteCloudinaryAssets(uploadedAssets);
    }

    throw error;
  }
};

/**
 * Delete one Cloudinary asset.
 */
export const deleteCloudinaryAsset = async ({
  publicId,
  mediaType = "image",
}) => {
  if (!publicId) {
    return null;
  }

  const resourceType =
    mediaType === "video"
      ? "video"
      : mediaType === "document"
        ? "raw"
        : "image";

  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    throw new AppError(
      `Cloudinary deletion failed: ${error.message}`,
      502,
    );
  }
};

/**
 * Delete several Cloudinary media records.
 *
 * Uses Promise.allSettled so one failed deletion does not
 * prevent attempts to delete the remaining assets.
 */
export const deleteCloudinaryAssets = async (media = []) => {
  if (!Array.isArray(media) || media.length === 0) {
    return {
      deleted: 0,
      failed: 0,
      results: [],
    };
  }

  const validMedia = media.filter(
    (item) => item?.publicId,
  );

  const results = await Promise.allSettled(
    validMedia.map((item) =>
      deleteCloudinaryAsset({
        publicId: item.publicId,
        mediaType: item.mediaType,
      }),
    ),
  );

  const deleted = results.filter(
    (result) => result.status === "fulfilled",
  ).length;

  const failed = results.filter(
    (result) => result.status === "rejected",
  ).length;

  return {
    deleted,
    failed,
    results,
  };
};

export default cloudinary;