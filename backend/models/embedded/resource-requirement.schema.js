import mongoose from "mongoose";

const { Schema } = mongoose;

export const resourceRequirementSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
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
    },

    quantityRequired: {
      type: Number,
      required: true,
      min: 0.01,
    },

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
    type:Number,
    min:0,
    default:null
},
    requiredFrom: {
      type: Date,
    },

    requiredUntil: {
      type: Date,
    },

    serviceArea: {
      type: String,
      trim: true,
      maxlength: 150,
    },

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
    },

    isVerifiedRequest: {
      type: Boolean,
      default: false,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
);