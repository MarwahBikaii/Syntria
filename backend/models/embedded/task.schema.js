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
      default: null,
    },
  },
  {
    _id: true,
  }
);

/**
 * Validate the dependency according to its type.
 */
taskDependencySchema.pre(
  "validate",
  function validateDependency() {
    if (
      this.type === DEPENDENCY_TYPES.TASK &&
      !this.taskId
    ) {
      throw new Error(
        "taskId is required for a task dependency."
      );
    }

    if (
      this.type === DEPENDENCY_TYPES.RESOURCE &&
      !this.resourceRequirementId
    ) {
      throw new Error(
        "resourceRequirementId is required for a resource dependency."
      );
    }

    if (
      this.type === DEPENDENCY_TYPES.APPROVAL &&
      !this.approvalType
    ) {
      throw new Error(
        "approvalType is required for an approval dependency."
      );
    }
  }
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

    /*
     * References an embedded phase _id
     * inside the same Initiative document.
     */
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
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      default: [],
    },

    volunteerSlots: {
      type: Number,
      min: 0,
      default: 0,
    },

    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    scheduledStartAt: {
      type: Date,
      default: null,
    },

    scheduledEndAt: {
      type: Date,
      default: null,
    },

    actualStartAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
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
  }
);

/**
 * Validate task schedule.
 */
taskSchema.pre(
  "validate",
  function validateTaskSchedule() {
    if (
      this.scheduledStartAt &&
      this.scheduledEndAt &&
      this.scheduledEndAt <= this.scheduledStartAt
    ) {
      throw new Error(
        "Task scheduled end date must be after its start date."
      );
    }
  }
);