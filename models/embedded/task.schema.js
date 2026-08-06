import mongoose from "mongoose";

import {
  DEPENDENCY_TYPES,
  TASK_STATUSES,
} from "../../constants/enums.js";

const { Schema } = mongoose;

const taskDependencySchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(DEPENDENCY_TYPES),
      required: true,
    },

    taskId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    resourceRequirementId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    approvalType: {
      type: String,
      trim: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: true,
  },
);

export const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    phaseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: Object.values(TASK_STATUSES),
      default: TASK_STATUSES.LOCKED,
    },

    dependencies: {
      type: [taskDependencySchema],
      default: [],
    },

    assignedOrganization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    requiredSkills: {
      type: [String],
      default: [],
    },

    volunteerSlots: {
      type: Number,
      min: 0,
      default: 0,
    },

    scheduledStartAt: {
      type: Date,
    },

    scheduledEndAt: {
      type: Date,
    },

    actualStartAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },

    completionEvidence: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    isLocked: {
      type: Boolean,
      default: true,
    },

    lockReasons: {
      type: [String],
      default: [],
    },
  },
  {
    _id: true,
  },
);