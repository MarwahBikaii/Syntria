import mongoose from "mongoose";

const { Schema, model } = mongoose;

const resourceRequirementSchema = new Schema(
  {
    /*
     * ---------------------------------------------------
     * Parent Initiative
     * ---------------------------------------------------
     */

    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    /*
     * ---------------------------------------------------
     * Requirement details
     * ---------------------------------------------------
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

    quantityRequired: {
      type: Number,
      required: true,
      min: 0.01,
    },

    /*
     * Cached total quantity currently reserved.
     *
     * Keep this synchronized whenever reservations
     * are created/released/cancelled.
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

    /*
     * ---------------------------------------------------
     * Budget / cost expectation
     * ---------------------------------------------------
     */

    estimatedCost: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "USD",
    },

    /*
     * ---------------------------------------------------
     * Availability requirement
     * ---------------------------------------------------
     */

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
      index: true,
    },

    /*
     * ---------------------------------------------------
     * Requirement lifecycle
     * ---------------------------------------------------
     */

    status: {
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

    /*
     * Municipality approval can verify requirements
     * before matching or partner requests begin.
     */
    isVerifiedRequest: {
      type: Boolean,
      default: false,
      index: true,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "resourcerequirements",
  }
);

/*
 * -------------------------------------------------------
 * Indexes
 * -------------------------------------------------------
 */

resourceRequirementSchema.index({
  initiative: 1,
  status: 1,
});

resourceRequirementSchema.index({
  initiative: 1,
  isVerifiedRequest: 1,
});

resourceRequirementSchema.index({
  category: 1,
  serviceArea: 1,
  status: 1,
});

/*
 * -------------------------------------------------------
 * Validation
 * -------------------------------------------------------
 */

resourceRequirementSchema.pre(
  "validate",
  function validateResourceRequirement() {
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

    if (
      this.quantityReserved >
      this.quantityRequired
    ) {
      throw new Error(
        "Reserved quantity cannot exceed required quantity."
      );
    }
  }
);

export const ResourceRequirement =
  mongoose.models.ResourceRequirement ||
  model(
    "ResourceRequirement",
    resourceRequirementSchema
  );