import mongoose from "mongoose";

const { Schema, model } = mongoose;

const resourceReservationSchema =
  new Schema(
    {
      /*
       * -------------------------------------------------
       * Core relationships
       * -------------------------------------------------
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

      /*
       * -------------------------------------------------
       * Reservation source
       *
       * Exactly ONE must exist:
       *
       * ResourceRequest
       * OR
       * ContributionOffer
       * -------------------------------------------------
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
       * ContributionOffer contains multiple items.
       *
       * This tells us exactly which embedded offer item
       * produced this reservation.
       */
      contributionOfferItemId: {
        type: Schema.Types.ObjectId,
        default: null,
      },

      /*
       * -------------------------------------------------
       * Reserved allocation
       * -------------------------------------------------
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
       * -------------------------------------------------
       * Accepted financial snapshot
       * -------------------------------------------------
       *
       * Important:
       * Do not depend forever on ContributionOffer prices.
       * Store what was actually agreed.
       */

      agreedUnitPrice: {
        type: Number,
        min: 0,
        default: null,
      },

      agreedAdditionalCost: {
        type: Number,
        min: 0,
        default: 0,
      },

      agreedTotalCost: {
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
       * -------------------------------------------------
       * Reservation lifecycle
       * -------------------------------------------------
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

      collection:
        "resourcereservations",
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



/*
 * -------------------------------------------------------
 * Validation
 * -------------------------------------------------------
 */

resourceReservationSchema.pre(
  "validate",
  function validateReservation() {
    const hasResourceRequest =
      Boolean(this.resourceRequest);

    const hasContributionOffer =
      Boolean(this.contributionOffer);

    /*
     * Exactly one reservation source.
     */
    if (
      hasResourceRequest ===
      hasContributionOffer
    ) {
      throw new Error(
        "A reservation must originate from either a resource request or a contribution offer, but not both."
      );
    }

    /*
     * Contribution offer contains multiple items,
     * so item ID is mandatory for offer-based
     * reservations.
     */
    if (
      hasContributionOffer &&
      !this.contributionOfferItemId
    ) {
      throw new Error(
        "contributionOfferItemId is required for a contribution-offer reservation."
      );
    }

    /*
     * A request-based reservation must not point
     * to a contribution item.
     */
    if (
      hasResourceRequest &&
      this.contributionOfferItemId
    ) {
      throw new Error(
        "contributionOfferItemId must be null for a resource-request reservation."
      );
    }

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