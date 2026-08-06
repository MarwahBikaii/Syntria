import mongoose from "mongoose";

const { Schema, model } = mongoose;

const executionEventSchema = new Schema(
  {
    initiative: {
      type: Schema.Types.ObjectId,
      ref: "Initiative",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: [
        "initiative_approved",
        "initiative_started",
        "task_unlocked",
        "task_locked",
        "task_started",
        "task_completed",
        "resource_reserved",
        "resource_delivered",
        "resource_withdrawn",
        "volunteer_assigned",
        "volunteer_checked_in",
        "volunteer_completed",
        "readiness_changed",
        "inspection_completed",
        "completion_requested",
        "completion_approved",
        "completion_rejected",
        "initiative_published",
      ],
      required: true,
      index: true,
    },

    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    taskId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      default: null,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

executionEventSchema.index({
  initiative: 1,
  occurredAt: 1,
});

executionEventSchema.index({
  initiative: 1,
  eventType: 1,
  occurredAt: -1,
});

executionEventSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function preventUpdates() {
    throw new Error(
      "Execution history records are immutable and cannot be updated.",
    );
  },
);

export const ExecutionEvent = model(
  "ExecutionEvent",
  executionEventSchema,
);