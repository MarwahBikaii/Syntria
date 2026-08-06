import mongoose from "mongoose";

import { APPLICATION_STATUSES } from "../constants/enums.js";

const { Schema, model } = mongoose;

const volunteerApplicationSchema = new Schema(
  {
    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    taskId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    volunteer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUSES),
      default: APPLICATION_STATUSES.PENDING,
      index: true,
    },

    applicationMessage: {
      type: String,
      trim: true,
      maxlength: 1500,
    },

    eligibilitySnapshot: {
      matchedSkills: {
        type: [String],
        default: [],
      },

      missingSkills: {
        type: [String],
        default: [],
      },

      serviceAreaMatched: {
        type: Boolean,
        default: false,
      },

      taskUnlockedAtApplication: {
        type: Boolean,
        default: false,
      },
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: {
      type: Date,
    },

    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1500,
    },

    checkInAt: {
      type: Date,
    },

    checkOutAt: {
      type: Date,
    },

    completionEvidenceMediaIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

volunteerApplicationSchema.index(
  {
    initiative: 1,
    taskId: 1,
    volunteer: 1,
  },
  {
    unique: true,
  },
);

volunteerApplicationSchema.index({
  volunteer: 1,
  status: 1,
  createdAt: -1,
});

export const VolunteerApplication = model(
  "VolunteerApplication",
  volunteerApplicationSchema,
);