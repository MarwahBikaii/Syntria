import mongoose from "mongoose";

import { WORK_ITEM_TYPES } from "../constants/enums.js";

import { locationSchema } from "./embedded/location.schema.js";
import { mediaSchema } from "./embedded/media.schema.js";

const { Schema, model } = mongoose;



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



    tags: {
      type: [String],
      default: [],
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