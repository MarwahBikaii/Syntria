import { Notification } from "../models/notification.model.js";
import { AppError } from "../utils/app-error.js";

/**
 * Create one notification.
 */
export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  session = null,
}) => {
  if (!recipient) {
    throw AppError.badRequest(
      "Notification recipient is required.",
    );
  }

  if (!type) {
    throw AppError.badRequest(
      "Notification type is required.",
    );
  }

  if (!title?.trim()) {
    throw AppError.badRequest(
      "Notification title is required.",
    );
  }

  if (!message?.trim()) {
    throw AppError.badRequest(
      "Notification message is required.",
    );
  }

  const payload = {
    recipient,
    type,
    title: title.trim(),
    message: message.trim(),
    relatedEntity:
      entityType && entityId
        ? {
            entityType,
            entityId,
          }
        : undefined,
    actionUrl: actionUrl?.trim() || null,
  };

  const options = session ? { session } : {};

  const [notification] = await Notification.create(
    [payload],
    options,
  );

  return notification;
};

/**
 * Create several notifications.
 *
 * Useful when multiple stakeholders must be notified.
 */
export const createNotifications = async ({
  notifications,
  session = null,
}) => {
  if (
    !Array.isArray(notifications) ||
    notifications.length === 0
  ) {
    return [];
  }

  const payloads = notifications.map(
    (notification, index) => {
      const {
        recipient,
        type,
        title,
        message,
        entityType = null,
        entityId = null,
        actionUrl = null,
      } = notification;

      if (!recipient) {
        throw AppError.badRequest(
          `notifications[${index}].recipient is required.`,
        );
      }

      if (!type) {
        throw AppError.badRequest(
          `notifications[${index}].type is required.`,
        );
      }

      if (!title?.trim()) {
        throw AppError.badRequest(
          `notifications[${index}].title is required.`,
        );
      }

      if (!message?.trim()) {
        throw AppError.badRequest(
          `notifications[${index}].message is required.`,
        );
      }

      return {
        recipient,
        type,
        title: title.trim(),
        message: message.trim(),
        relatedEntity:
          entityType && entityId
            ? {
                entityType,
                entityId,
              }
            : undefined,
        actionUrl: actionUrl?.trim() || null,
      };
    },
  );

  return Notification.insertMany(payloads, {
    session,
    ordered: true,
  });
};

/**
 * Mark one notification as delivered.
 */
export const markNotificationDelivered = async ({
  notificationId,
}) => {
  const notification =
    await Notification.findByIdAndUpdate(
      notificationId,
      {
        $set: {
          deliveredAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

  if (!notification) {
    throw AppError.notFound(
      "Notification not found.",
    );
  }

  return notification;
};

/**
 * Mark one notification as read.
 *
 * The recipient is checked so one user cannot mark another
 * user's notification as read.
 */
export const markNotificationRead = async ({
  notificationId,
  recipient,
}) => {
  const notification =
    await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient,
      },
      {
        $set: {
          readAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

  if (!notification) {
    throw AppError.notFound(
      "Notification not found.",
    );
  }

  return notification;
};

/**
 * Mark all unread notifications as read for one user.
 */
export const markAllNotificationsRead = async ({
  recipient,
}) => {
  if (!recipient) {
    throw AppError.badRequest(
      "Notification recipient is required.",
    );
  }

  const result = await Notification.updateMany(
    {
      recipient,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
};

/**
 * Get paginated notifications for one user.
 */
export const getUserNotifications = async ({
  recipient,
  page = 1,
  limit = 20,
  unreadOnly = false,
}) => {
  if (!recipient) {
    throw AppError.badRequest(
      "Notification recipient is required.",
    );
  }

  const pageNumber = Math.max(
    Number.parseInt(page, 10) || 1,
    1,
  );

  const limitNumber = Math.min(
    Math.max(Number.parseInt(limit, 10) || 20, 1),
    100,
  );

  const filter = {
    recipient,
  };

  if (
    unreadOnly === true ||
    unreadOnly === "true"
  ) {
    filter.readAt = null;
  }

  const skip =
    (pageNumber - 1) * limitNumber;

  const [notifications, total, unreadCount] =
    await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        recipient,
        readAt: null,
      }),
    ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages:
        total === 0
          ? 0
          : Math.ceil(total / limitNumber),
    },
  };
};

/**
 * Permanently delete one notification belonging to a user.
 */
export const deleteNotification = async ({
  notificationId,
  recipient,
}) => {
  const notification =
    await Notification.findOneAndDelete({
      _id: notificationId,
      recipient,
    });

  if (!notification) {
    throw AppError.notFound(
      "Notification not found.",
    );
  }

  return {
    deletedNotificationId: notification._id,
  };
};