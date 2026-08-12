import mongoose from "mongoose";

import {
  OFFER_STATUSES,
} from "../constants/enums.js";

const { Schema, model } = mongoose;

const contributionItemSchema = new Schema(
  {
    /*
     * Requirement being fulfilled.
     */
    resourceRequirement: {
      type: Schema.Types.ObjectId,
      ref: "ResourceRequirement",
      required: true,
      index: true,
    },

    /*
     * Actual resource being offered.
     */
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
      maxlength: 50,
    },

    /*
     * ---------------------------------------------------
     * Financial offer
     * ---------------------------------------------------
     */

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    additionalCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    /*
     * Calculated automatically:
     *
     * quantityOffered * unitPrice
     * + additionalCost
     */
    totalCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "USD",
    },

    /*
     * Donations automatically have zero cost.
     */
    isDonation: {
      type: Boolean,
      default: false,
    },

    /*
     * ---------------------------------------------------
     * Availability
     * ---------------------------------------------------
     */

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
      default: null,
    },
  },
  {
    _id: true,
  }
);

/*
 * -------------------------------------------------------
 * Contribution item validation + cost calculation
 * -------------------------------------------------------
 */

contributionItemSchema.pre(
  "validate",
  function validateContributionItem() {
    if (
      this.availableFrom &&
      this.availableUntil &&
      this.availableUntil <=
        this.availableFrom
    ) {
      throw new Error(
        "Offer availability end date must be after start date."
      );
    }

    if (this.isDonation) {
      this.unitPrice = 0;
      this.additionalCost = 0;
      this.totalCost = 0;

      return;
    }

    this.totalCost =
      this.quantityOffered *
        this.unitPrice +
      this.additionalCost;
  }
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
          return (
            Array.isArray(items) &&
            items.length > 0
          );
        },

        message:
          "A contribution offer must contain at least one resource item.",
      },
    },

    status: {
      type: String,
      enum: Object.values(
        OFFER_STATUSES
      ),
      default:
        OFFER_STATUSES.SUBMITTED,
      index: true,
    },

    organizationNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: null,
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
    collection: "contributionoffers",
  }
);

/*
 * -------------------------------------------------------
 * Indexes
 * -------------------------------------------------------
 */

contributionOfferSchema.index({
  initiative: 1,
  partnerOrganization: 1,
  status: 1,
});

contributionOfferSchema.index({
  partnerOrganization: 1,
  createdAt: -1,
});

contributionOfferSchema.index({
  "items.resourceRequirement": 1,
  status: 1,
});

export const ContributionOffer =
  mongoose.models.ContributionOffer ||
  model(
    "ContributionOffer",
    contributionOfferSchema
  );