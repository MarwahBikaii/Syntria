import mongoose from "mongoose";

import {
  RESOURCE_REQUEST_STATUSES,
} from "../constants/enums.js";

const { Schema, model } = mongoose;

const resourceRequestSchema = new Schema(
  {
    /*
     * ---------------------------------------------------
     * Core relationships
     * ---------------------------------------------------
     */

    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    resourceRequirement: {
      type: Schema.Types.ObjectId,
      ref: "ResourceRequirement",
      required: true,
      index: true,
    },

    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },

    partnerOrganization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /*
     * ---------------------------------------------------
     * Request details
     * ---------------------------------------------------
     */

    quantityRequested: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    requestedFrom: {
      type: Date,
      required: true,
    },

    requestedUntil: {
      type: Date,
      required: true,
    },

    requestNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    /*
     * ---------------------------------------------------
     * Request lifecycle
     * ---------------------------------------------------
     */

    status: {
      type: String,
      enum: Object.values(
        RESOURCE_REQUEST_STATUSES
      ),
      default:
        RESOURCE_REQUEST_STATUSES.PENDING,
      index: true,
    },

    review: {
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

    withdrawnAt: {
      type: Date,
      default: null,
    },

    withdrawalReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "resourcerequests",
  }
);

/*
 * -------------------------------------------------------
 * Indexes
 * -------------------------------------------------------
 */

resourceRequestSchema.index({
  resourceRequirement: 1,
  status: 1,
});

resourceRequestSchema.index({
  initiative: 1,
  partnerOrganization: 1,
  status: 1,
});

resourceRequestSchema.index({
  partnerOrganization: 1,
  status: 1,
  createdAt: -1,
});

/*
 * -------------------------------------------------------
 * Validation
 * -------------------------------------------------------
 */

resourceRequestSchema.pre(
  "validate",
  function validateResourceRequest() {
    if (
      this.requestedFrom &&
      this.requestedUntil &&
      this.requestedUntil <=
        this.requestedFrom
    ) {
      throw new Error(
        "Requested end date must be after requested start date."
      );
    }
  }
);

export const ResourceRequest =
  mongoose.models.ResourceRequest ||
  model(
    "ResourceRequest",
    resourceRequestSchema
  );