import mongoose from "mongoose";

import {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  VERIFICATION_STATUSES,
} from "../constants/enums.js";

const { Schema, model } = mongoose;

/**
 * Embedded contact information.
 */
const contactSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address.",
      ],
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    websiteUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/**
 * Embedded organization address.
 */
const addressSchema = new Schema(
  {
    line: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    region: {
      type: String,
      required: true,
      trim: true,
    },

    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },

    locationType: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },

    coordinates: {
      type: [Number],
      validate: {
        validator(value) {
          return value.length === 2;
        },
        message:
          "Coordinates must contain [longitude, latitude].",
      },
      default: [0, 0],
    },
  },
  {
    _id: false,
  }
);

const organizationSchema = new Schema(
  {
    organizationType: {
      type: String,
      enum: Object.values(ORGANIZATION_TYPES),
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      default: VERIFICATION_STATUSES.PENDING,
    },

    status: {
      type: String,
      enum: Object.values(ORGANIZATION_STATUSES),
      default: ORGANIZATION_STATUSES.ACTIVE,
    },

    contact: {
      type: contactSchema,
      required: true,
    },

    address: {
      type: addressSchema,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "organizations",
  }
);

organizationSchema.index({ organizationType: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ verificationStatus: 1 });

organizationSchema.index({
  "address.coordinates": "2dsphere",
});

const Organization =
  mongoose.models.Organization ||
  model("Organization", organizationSchema);

export default Organization;