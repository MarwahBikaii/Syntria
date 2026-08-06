import mongoose from "mongoose";

import { WORK_ITEM_TYPES } from "../constants/enums.js";

import { locationSchema } from "./embedded/location.schema.js";
import { mediaSchema } from "./embedded/media.schema.js";

const { Schema, model } = mongoose;

const statusHistorySchema = new Schema(
  {
    fromStatus: {
      type: String,
      default: null,
    },

    toStatus: {
      type: String,
      required: true,
      trim: true,
    },

    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

const workItemSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 10000,
    },

    location: {
      type: locationSchema,
      required: true,
    },

    media: {
      type: [mediaSchema],
      default: [],
    },

    municipality: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedMunicipalityDepartment: {
      departmentId: {
        type: Schema.Types.ObjectId,
        default: null,
      },

      departmentName: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null,
      },
    },

    status: {
      type: String,
      required: true,
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },

    tags: {
      type: [String],
      default: [],
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    discriminatorKey: "workItemType",
    collection: "workitems",
  },
);

workItemSchema.index({
  municipality: 1,
  workItemType: 1,
  status: 1,
  createdAt: -1,
});

workItemSchema.index({
  createdBy: 1,
  workItemType: 1,
  createdAt: -1,
});

workItemSchema.index({
  title: "text",
  description: "text",
  tags: "text",
});

workItemSchema.index({
  "location.coordinates": "2dsphere",
});

export const WorkItem =
  mongoose.models.WorkItem ||
  model("WorkItem", workItemSchema);

export { WORK_ITEM_TYPES };