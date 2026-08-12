import mongoose from "mongoose";

import {
  INITIATIVE_STATUSES,
  READINESS_STATUSES,
  WORK_ITEM_TYPES,
} from "../constants/enums.js";

import { WorkItem } from "./work-item.model.js";
import { taskSchema } from "./embedded/task.schema.js";

const { Schema } = mongoose;

const phaseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    scheduledStartAt: {
      type: Date,
    },

    scheduledEndAt: {
      type: Date,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "locked",
        "active",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
  },
  {
    _id: true,
  },
);

const approvalSchema = new Schema(
  {
    decision: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      default: "pending",
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    reviewedAt: {
      type: Date,
    },

    revisionNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const readinessSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(READINESS_STATUSES),
      default: READINESS_STATUSES.BLOCKED,
    },

    municipalityApproved: {
      type: Boolean,
      default: false,
    },

    resourcesSatisfied: {
      type: Boolean,
      default: false,
    },

    dependenciesSatisfied: {
      type: Boolean,
      default: false,
    },

    blockingReasons: {
      type: [String],
      default: [],
    },

    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const inspectionSchema = new Schema(
  {
    inspectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    decision: {
      type: String,
      enum: [
        "pending",
        "passed",
        "failed",
        "changes_required",
      ],
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    evidenceMediaIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    inspectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

const initiativeSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(INITIATIVE_STATUSES),
    default: INITIATIVE_STATUSES.DRAFT,
  },
  submittedAt: {
    type: Date,
    default: null,
  },

  sourceIssue: {
    type: Schema.Types.ObjectId,
    ref: "Issue",
    default: null,
    index: true,
  },

  leadOrganization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },

  expectedOutcome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },

  executionPeriod: {
    plannedStartAt: {
      type: Date,
      required: true,
    },

    plannedEndAt: {
      type: Date,
      required: true,
    },

    actualStartAt: {
      type: Date,
    },

    actualEndAt: {
      type: Date,
    },
  },

  phases: {
    type: [phaseSchema],
    default: [],
  },

  tasks: {
    type: [taskSchema],
    default: [],
  },



  availableResources: [
    {
      resource: {
        type: Schema.Types.ObjectId,
        ref: "Resource",
      },

      quantity: {
        type: Number,
        min: 0,
      },

      notes: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    },
  ],

  approval: {
    type: approvalSchema,
    default: () => ({}),
  },

  readiness: {
    type: readinessSchema,
    default: () => ({}),
  },

  inspections: {
    type: [inspectionSchema],
    default: [],
  },

  completionRequest: {
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    requestedAt: {
      type: Date,
    },
  },

  impactMetrics: [
    {
      metricName: {
        type: String,
        required: true,
        trim: true,
      },

      value: {
        type: Number,
        required: true,
      },

      unit: {
        type: String,
        required: true,
        trim: true,
      },

      verified: {
        type: Boolean,
        default: false,
      },
    },
  ],

  publishedAt: {
    type: Date,
    default: null,
  },
});

initiativeSchema.index({
  municipality: 1,
  status: 1,
  "readiness.status": 1,
});

initiativeSchema.index({
  leadOrganization: 1,
  status: 1,
  createdAt: -1,
});

initiativeSchema.pre(
  "validate",
  function validateExecutionPeriod() {
    const { plannedStartAt, plannedEndAt } =
      this.executionPeriod ?? {};

    if (
      plannedStartAt &&
      plannedEndAt &&
      plannedEndAt <= plannedStartAt
    ) {
      throw new Error(
        "The planned initiative end date must be after its start date.",
      );
    }
  },
);

export const Initiative = WorkItem.discriminator(
  WORK_ITEM_TYPES.INITIATIVE,
  initiativeSchema,
);