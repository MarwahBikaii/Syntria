import mongoose from "mongoose";

const { Schema } = mongoose;

export const locationSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    municipalityName: {
      type: String,
      trim: true,
      maxlength: 150,
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
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        validate: {
          validator(value) {
            if (!value || value.length === 0) {
              return true;
            }

            if (value.length !== 2) {
              return false;
            }

            const [longitude, latitude] = value;

            return (
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
  },
  {
    _id: false,
  },
);