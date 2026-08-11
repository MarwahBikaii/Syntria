import mongoose from "mongoose";

const { Schema, model } = mongoose;

const availabilityWindowSchema = new Schema(
  {
    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  },
);

const resourceSchema = new Schema(
  {
    ownerOrganization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
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
      maxlength: 3000,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    resourceType: {
      type: String,
      enum: [
        "equipment",
        "vehicle",
        "material",
        "venue",
        "service",
        "funding",
        "expertise",
        "other",
      ],
      required: true,
      index: true,
    },

    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    serviceAreas: {
      type: [String],
      default: [],
    },

    availabilityWindows: {
      type: [availabilityWindowSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "available",
        "partially_reserved",
        "fully_reserved",
        "unavailable",
        "inactive",
      ],
      default: "available",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

resourceSchema.index({
  ownerOrganization: 1,
  category: 1,
  status: 1,
});

resourceSchema.index({
  category: 1,
  serviceAreas: 1,
  status: 1,
});

availabilityWindowSchema.pre(
  "validate",
  function validateWindow() {
    if (this.endAt <= this.startAt) {
      throw new Error(
        "Resource availability end time must be after start time."
      );
    }
  }
);

export const Resource = model("Resource", resourceSchema);