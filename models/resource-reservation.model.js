import mongoose from "mongoose";

const { Schema, model } = mongoose;

const resourceReservationSchema = new Schema(
  {
    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },

    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    contributionOffer: {
      type: Schema.Types.ObjectId,
      ref: "ContributionOffer",
      required: true,
    },

    resourceRequirementId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    reservedFrom: {
      type: Date,
      required: true,
    },

    reservedUntil: {
      type: Date,
      required: true,
    },

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
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

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

resourceReservationSchema.pre(
  "validate",
  function validateReservationDates(next) {
    if (this.reservedUntil <= this.reservedFrom) {
      return next(
        new Error(
          "Reservation end date must be after its start date.",
        ),
      );
    }

    return next();
  },
);

export const ResourceReservation = model(
  "ResourceReservation",
  resourceReservationSchema,
);