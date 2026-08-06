import mongoose from "mongoose";

const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "issue_status_changed",
        "initiative_decision",
        "resource_match",
        "new_contribution_offer",
        "resource_withdrawn",
        "resource_reassigned",
        "volunteer_assignment",
        "schedule_updated",
        "readiness_changed",
        "completion_decision",
        "system",
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    relatedEntity: {
      entityType: {
        type: String,
        enum: [
          "Issue",
          "Initiative",
          "ContributionOffer",
          "Resource",
          "VolunteerApplication",
          "Organization",
        ],
      },

      entityId: {
        type: Schema.Types.ObjectId,
      },
    },

    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    readAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({
  recipient: 1,
  readAt: 1,
  createdAt: -1,
});

export const Notification = model(
  "Notification",
  notificationSchema,
);