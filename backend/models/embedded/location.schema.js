import mongoose from "mongoose";

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },

    coordinates: {
      type: [Number],


      default: undefined,

      required: true,

      validate: {
        validator(value) {
          if (
            !Array.isArray(value) ||
            value.length !== 2
          ) {
            return false;
          }

          const [longitude, latitude] =
            value;

          return (
            Number.isFinite(longitude) &&
            Number.isFinite(latitude) &&
            longitude >= -180 &&
            longitude <= 180 &&
            latitude >= -90 &&
            latitude <= 90
          );
        },

        message:
          "Coordinates must contain valid [longitude, latitude] values.",
      },
    },
  },
  {
    _id: false,
  }
);

export const locationSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    district: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    country: {
      type: String,
      trim: true,
      default: "Lebanon",
      maxlength: 100,
    },

    coordinates: {
      type: pointSchema,

      default: undefined,
    },
  },
  {
    _id: false,
  }
);
locationSchema.pre("validate", function () {
  const values =
    this.coordinates?.coordinates;

  if (
    !Array.isArray(values) ||
    values.length !== 2
  ) {
    this.coordinates = undefined;
  }
});