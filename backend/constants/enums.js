export const USER_ROLES = Object.freeze({
  MUNICIPALITY: "municipality",
  COMMUNITY_ORGANIZATION: "community_organization",
  RESOURCE_PARTNER: "resource_partner",
  COMMUNITY_MEMBER: "community_member",
});

export const USER_ROLES_IN_ORGANIZATION = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
});

export const ORGANIZATION_TYPES = Object.freeze({
  MUNICIPALITY: "municipality",
  COMMUNITY_ORGANIZATION: "community_organization",
  RESOURCE_PARTNER: "resource_partner",
});
export const ORGANIZATION_STATUSES = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
});

export const VERIFICATION_STATUSES = Object.freeze({
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
});
export const ACCOUNT_STATUSES = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
});

export const WORK_ITEM_TYPES = Object.freeze({
  ISSUE: "Issue",
  INITIATIVE: "Initiative",
});

export const ISSUE_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  RESOLVED_INTERNALLY: "resolved_internally",
  CONVERTED_TO_INITIATIVE: "converted_to_initiative",
  REJECTED: "rejected",
  CLOSED: "closed",
});
export const MUNICIPALITY_REVIEW_DECISIONS = Object.freeze({

  RESOLVE_INTERNALLY: "resolve_internally",
  CONVERT_TO_INITIATIVE: "convert_to_initiative",
  REJECT: "reject",
});
export const INITIATIVE_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  CHANGES_REQUESTED: "changes_requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  IN_PROGRESS: "in_progress",
  COMPLETION_REQUESTED: "completion_requested",
  COMPLETED: "completed",
  PUBLISHED: "published",
  CANCELLED: "cancelled",
});

export const READINESS_STATUSES = Object.freeze({
  BLOCKED: "blocked",
  PARTIALLY_RESOURCED: "partially_resourced",
  READY_TO_EXECUTE: "ready_to_execute",
});

export const TASK_STATUSES = Object.freeze({
  LOCKED: "locked",
  AVAILABLE: "available",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
});

export const DEPENDENCY_TYPES = Object.freeze({
  TASK: "task",
  RESOURCE: "resource",
  APPROVAL: "approval",
});



export const OFFER_STATUSES = Object.freeze({
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  COMPLETED: "completed",
});

export const APPLICATION_STATUSES = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  COMPLETED: "completed",
});

export const RESOURCE_REQUEST_STATUSES =
  Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    WITHDRAWN: "withdrawn",
    FULFILLED: "fulfilled",
  });