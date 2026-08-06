import mongoose from "mongoose";

const { Schema } = mongoose;

export const mediaSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
      type: String,
      trim: true,
    },

    mediaType: {
      type: String,
      enum: ["image", "video", "document"],
      required: true,
    },

    fileName: {
      type: String,
      trim: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    sizeBytes: {
      type: Number,
      min: 0,
    },

    evidenceType: {
      type: String,
      enum: [
        "supporting",
        "before",
        "during",
        "after",
        "completion",
        "inspection",
      ],
      default: "supporting",
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);