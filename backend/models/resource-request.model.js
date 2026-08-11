import mongoose from "mongoose";

import {
  RESOURCE_REQUEST_STATUSES,
} from "../constants/enums.js";

const { Schema, model } = mongoose;

const resourceRequestSchema = new Schema(
  {
    /*
     * =====================================================
     * Parent Initiative
     * =====================================================
     */

    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    /*
     * =====================================================
     * RESOURCE REQUIREMENT DATA
     *
     * Previously embedded inside Initiative.
     * =====================================================
     */

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },

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
      default: null,
    },

    /*
     * Total amount required by the initiative.
     */
    quantityRequired: {
      type: Number,
      required: true,
      min: 0.01,
    },

    /*
     * Amount already reserved.
     */
    quantityReserved: {
      type: Number,
      min: 0,
      default: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    estimatedCost: {
      type: Number,
      min: 0,
      default: null,
    },

    requiredFrom: {
      type: Date,
      default: null,
    },

    requiredUntil: {
      type: Date,
      default: null,
    },

    serviceArea: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    /*
     * Municipality approval / initiative approval
     * can verify this requirement before partners
     * are contacted.
     */
    isVerifiedRequest: {
      type: Boolean,
      default: false,
      index: true,
    },

    /*
     * Tracks fulfillment of the actual initiative need.
     *
     * DO NOT mix this with the request workflow status.
     */
    fulfillmentStatus: {
      type: String,
      enum: [
        "unmet",
        "partially_met",
        "fully_reserved",
        "delivered",
        "cancelled",
      ],
      default: "unmet",
      index: true,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },

    /*
     * =====================================================
     * RESOURCE PARTNER REQUEST DATA
     * =====================================================
     *
     * Optional until the Community Organization selects
     * a specific resource/partner.
     */

    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      default: null,
      index: true,
    },

    partnerOrganization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
     * Amount being requested from this selected partner.
     */
    quantityRequested: {
      type: Number,
      min: 0.01,
      default: null,
    },

    requestedFrom: {
      type: Date,
      default: null,
    },

    requestedUntil: {
      type: Date,
      default: null,
    },

    requestNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    /*
     * =====================================================
     * REQUEST WORKFLOW
     * =====================================================
     *
     * Different from fulfillmentStatus.
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
 * ==========================================================
 * Indexes
 * ==========================================================
 */

resourceRequestSchema.index({
  initiative: 1,
  fulfillmentStatus: 1,
});

resourceRequestSchema.index({
  initiative: 1,
  partnerOrganization: 1,
  status: 1,
});

resourceRequestSchema.index({
  category: 1,
  serviceArea: 1,
  fulfillmentStatus: 1,
});

resourceRequestSchema.index({
  partnerOrganization: 1,
  status: 1,
  createdAt: -1,
});

/*
 * ==========================================================
 * Validation
 * ==========================================================
 */

resourceRequestSchema.pre(
  "validate",
  function validateResourceRequest() {
    /*
     * Requirement dates
     */
    if (
      this.requiredFrom &&
      this.requiredUntil &&
      this.requiredUntil <=
        this.requiredFrom
    ) {
      throw new Error(
        "Required end date must be after required start date."
      );
    }

    /*
     * Partner request dates
     */
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

    /*
     * Reserved quantity cannot exceed requirement.
     */
    if (
      this.quantityReserved >
      this.quantityRequired
    ) {
      throw new Error(
        "Reserved quantity cannot exceed required quantity."
      );
    }

    /*
     * Partner request cannot exceed remaining requirement.
     */
    if (
      this.quantityRequested !== null &&
      this.quantityRequested !== undefined
    ) {
      const remaining =
        this.quantityRequired -
        this.quantityReserved;

      if (
        this.quantityRequested >
        remaining
      ) {
        throw new Error(
          `Requested quantity cannot exceed remaining quantity (${remaining}).`
        );
      }
    }

    /*
     * If one partner/resource field exists,
     * require the related fields as well.
     */
    const hasPartnerRequest =
      Boolean(this.resource) ||
      Boolean(this.partnerOrganization) ||
      Boolean(this.requestedBy) ||
      this.quantityRequested != null;

    if (hasPartnerRequest) {
      if (!this.resource) {
        throw new Error(
          "resource is required when sending a resource request."
        );
      }

      if (!this.partnerOrganization) {
        throw new Error(
          "partnerOrganization is required when sending a resource request."
        );
      }

      if (!this.requestedBy) {
        throw new Error(
          "requestedBy is required when sending a resource request."
        );
      }

      if (!this.quantityRequested) {
        throw new Error(
          "quantityRequested is required when sending a resource request."
        );
      }

      if (!this.requestedFrom) {
        throw new Error(
          "requestedFrom is required when sending a resource request."
        );
      }

      if (!this.requestedUntil) {
        throw new Error(
          "requestedUntil is required when sending a resource request."
        );
      }
    }
  }
);

export const ResourceRequest =
  mongoose.models.ResourceRequest ||
  model(
    "ResourceRequest",
    resourceRequestSchema
  );