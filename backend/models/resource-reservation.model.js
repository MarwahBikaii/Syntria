import mongoose from "mongoose";

const { Schema, model } = mongoose;

const resourceReservationSchema = new Schema(
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

    /*
     * The original resource need belonging
     * to the initiative.
     */
    resourceRequirement: {
      type: Schema.Types.ObjectId,
      ref: "ResourceRequirement",
      required: true,
      index: true,
    },

    /*
     * The actual Resource being reserved.
     */
    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },

    /*
     * ---------------------------------------------------
     * Reservation source
     * ---------------------------------------------------
     *
     * Reservation can come from:
     *
     * 1. ResourceRequest
     * OR
     * 2. ContributionOffer
     *
     * Never both.
     */

    resourceRequest: {
      type: Schema.Types.ObjectId,
      ref: "ResourceRequest",
      default: null,
      index: true,
    },

    contributionOffer: {
      type: Schema.Types.ObjectId,
      ref: "ContributionOffer",
      default: null,
      index: true,
    },

    /*
     * ---------------------------------------------------
     * Reservation details
     * ---------------------------------------------------
     */

    quantity: {
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

    reservedFrom: {
      type: Date,
      required: true,
    },

    reservedUntil: {
      type: Date,
      required: true,
    },

    /*
     * ---------------------------------------------------
     * Reservation lifecycle
     * ---------------------------------------------------
     */

    status: {
      type: String,
      enum: [
        "active",
        "released",
        "withdrawn",
        "fulfilled",
        "cancelled",
      ],
      default: "active",
      index: true,
    },

    reservedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    releasedAt: {
      type: Date,
      default: null,
    },

    releaseReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "resourcereservations",
  }
);

/*
 * -------------------------------------------------------
 * Indexes
 * -------------------------------------------------------
 */

resourceReservationSchema.index({
  resource: 1,
  status: 1,
  reservedFrom: 1,
  reservedUntil: 1,
});

resourceReservationSchema.index({
  initiative: 1,
  status: 1,
});

resourceReservationSchema.index({
  resourceRequirement: 1,
  status: 1,
});

resourceReservationSchema.index({
  resourceRequest: 1,
});

resourceReservationSchema.index({
  contributionOffer: 1,
});

/*
 * -------------------------------------------------------
 * Validation
 * -------------------------------------------------------
 */

resourceReservationSchema.pre(
  "validate",
  function validateReservation() {
    /*
     * Reservation must originate from exactly
     * one source.
     */

    const hasResourceRequest =
      Boolean(this.resourceRequest);

    const hasContributionOffer =
      Boolean(this.contributionOffer);

    if (
      hasResourceRequest ===
      hasContributionOffer
    ) {
      throw new Error(
        "A reservation must originate from either a resource request or a contribution offer, but not both."
      );
    }

    /*
     * Reservation dates.
     */

    if (
      this.reservedFrom &&
      this.reservedUntil &&
      this.reservedUntil <=
        this.reservedFrom
    ) {
      throw new Error(
        "Reservation end date must be after its start date."
      );
    }
  }
);

export const ResourceReservation =
  mongoose.models.ResourceReservation ||
  model(
    "ResourceReservation",
    resourceReservationSchema
  );

  /**                 Initiative
                     │
                     ▼
           ResourceRequirement
                     │
            "We need 100 bags"
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
 ResourceRequest        ContributionOffer
 "Can you give 50?"     "We can give 20"
          │                     │
          └──────────┬──────────┘
                     ▼
            ResourceReservation
                     │
                     ▼
                  Resource */