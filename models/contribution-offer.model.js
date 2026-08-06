import mongoose from "mongoose";

import { OFFER_STATUSES } from "../constants/enums.js";

const { Schema, model } = mongoose;

const contributionItemSchema = new Schema(
  {
    resourceRequirementId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
    },

    quantityOffered: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    availableFrom: {
      type: Date,
      required: true,
    },

    availableUntil: {
      type: Date,
      required: true,
    },

    deliveryConditions: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    _id: true,
  },
);

const contributionOfferSchema = new Schema(
  {
    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    partnerOrganization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [contributionItemSchema],
      required: true,
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message:
          "A contribution offer must contain at least one resource item.",
      },
    },

    status: {
      type: String,
      enum: Object.values(OFFER_STATUSES),
      default: OFFER_STATUSES.SUBMITTED,
      index: true,
    },

    organizationNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    review: {
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      notes: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      reviewedAt: {
        type: Date,
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
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

contributionOfferSchema.index({
  initiative: 1,
  partnerOrganization: 1,
  status: 1,
});

contributionOfferSchema.index({
  partnerOrganization: 1,
  createdAt: -1,
});

export const ContributionOffer = model(
  "ContributionOffer",
  contributionOfferSchema,
);