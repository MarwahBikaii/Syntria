import mongoose from "mongoose";

import {
  ISSUE_STATUSES,
  WORK_ITEM_TYPES,MUNICIPALITY_REVIEW_DECISIONS
} from "../constants/enums.js";

import { WorkItem } from "./work-item.model.js";

const { Schema } = mongoose;

const aiAnalysisSchema = new Schema(
  {
    category: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
    },

    suggestedDepartment: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    initiativeRecommendation: {
      shouldBecomeInitiative: {
        type: Boolean,
        default: false,
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    },

    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
    },

    modelName: {
      type: String,
      trim: true,
    },

    analyzedAt: {
      type: Date,
      default: Date.now,
    },

   
  },
  {
    _id: false,
  },
);

const duplicateCandidateSchema = new Schema(
  {
    issue: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },

    similarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },

    reasons: {
      type: [String],
      default: [],
    },

    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);



const municipalityReviewSchema = new Schema(
  {
    decision: {
      type: String,
      enum: Object.values(MUNICIPALITY_REVIEW_DECISIONS),
      default: MUNICIPALITY_REVIEW_DECISIONS.UNDER_REVIEW,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },


  },
  {
    _id: false,
  },
);

const issueSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(ISSUE_STATUSES),
    default: ISSUE_STATUSES.DRAFT,
  },

  category: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
  },

  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
    index: true,
  },

  aiAnalysis: {
    type: aiAnalysisSchema,
    default: null,
  },

  duplicateCandidates: {
    type: [duplicateCandidateSchema],
    default: [],
  },

  duplicateDecision: {
    type: String,
    enum: [
      "not_checked",
      "no_duplicate",
      "continued_as_new",
      "supported_existing",
    ],
    default: "not_checked",
  },

  supportedExistingIssue: {
    type: Schema.Types.ObjectId,
    ref: "Issue",
    default: null,
  },

  supporting_users: {
  type: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  default: [],
},

municipalityReview: {
  type: municipalityReviewSchema,
  default: null,
},

  convertedInitiative: {
    type: Schema.Types.ObjectId,
    ref: "Initiative",
    default: null,
  },

  resolvedInternallyAt: {
    type: Date,
    default: null,
  },
});

issueSchema.index({
  municipality: 1,
  priority: 1,
  status: 1,
  createdAt: -1,
});

issueSchema.index({
  "supporting_users": 1,
});

issueSchema.index({
  createdBy: 1,
  status: 1,
  createdAt: -1,
});

/*
 * Mongoose 9:
 * Do not use function(next).
 * Throwing an error stops validation.
 */
// issueSchema.pre(
//   "validate",
//   function validateIssueMedia() {
//     ...
//   }
// );
export const Issue =
  mongoose.models.Issue ||
  WorkItem.discriminator(
    WORK_ITEM_TYPES.ISSUE,
    issueSchema,
  );