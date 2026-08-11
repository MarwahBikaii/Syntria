import mongoose from "mongoose";

import { Resource } from "../models/resource.model.js";

import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  USER_ROLES_IN_ORGANIZATION,
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";


const ensureValidObjectId = (
  value,
  fieldName
) => {
  if (!mongoose.isValidObjectId(value)) {
    throw AppError.badRequest(
      `${fieldName} must be a valid MongoDB ObjectId.`
    );
  }
};


const getManagedResourcePartnerOrganizationIds = (
  authenticatedUser
) => {
  if (
    authenticatedUser.accountType !==
    USER_ROLES.RESOURCE_PARTNER
  ) {
    return [];
  }

  return (
    authenticatedUser.memberships
      ?.filter(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role)
      )
      .map(
        (membership) =>
          membership.organizationId
      ) ?? []
  );
};

export const createResourceService = async ({
  payload,
  authenticatedUser,
}) => {
  const {
    ownerOrganization: requestedOwnerOrganization,
    name,
    description,
    category,
    resourceType,
    totalQuantity,
    unit,
    serviceAreas = [],
    availabilityWindows = [],
  } = payload;

  if (!name?.trim()) {
    throw AppError.badRequest(
      "Resource name is required."
    );
  }

  if (!category?.trim()) {
    throw AppError.badRequest(
      "Resource category is required."
    );
  }

  if (!resourceType) {
    throw AppError.badRequest(
      "Resource type is required."
    );
  }

  if (
    totalQuantity === undefined ||
    Number(totalQuantity) < 0
  ) {
    throw AppError.badRequest(
      "totalQuantity must be 0 or greater."
    );
  }

  if (!unit?.trim()) {
    throw AppError.badRequest(
      "Resource unit is required."
    );
  }

  const managedOrganizationIds =
    getManagedResourcePartnerOrganizationIds(
      authenticatedUser
    );

  if (managedOrganizationIds.length === 0) {
    throw AppError.forbidden(
      "You must be an owner or administrator of a Resource Partner organization."
    );
  }

  let ownerOrganizationId;

  if (managedOrganizationIds.length === 1) {
    ownerOrganizationId =
      managedOrganizationIds[0];
  } else {
    if (!requestedOwnerOrganization) {
      throw AppError.badRequest(
        "ownerOrganization is required because you manage multiple Resource Partner organizations."
      );
    }

    ensureValidObjectId(
      requestedOwnerOrganization,
      "ownerOrganization"
    );

    const hasAccess =
      managedOrganizationIds.some(
        (organizationId) =>
          organizationId.toString() ===
          requestedOwnerOrganization.toString()
      );

    if (!hasAccess) {
      throw AppError.forbidden(
        "You cannot create resources for this organization."
      );
    }

    ownerOrganizationId =
      requestedOwnerOrganization;
  }

  const resource = await Resource.create({
    ownerOrganization:
      ownerOrganizationId,

    name: name.trim(),

    description:
      description?.trim() || "",

    category: category.trim(),

    resourceType,

    totalQuantity,

    unit: unit.trim(),

    serviceAreas:
      Array.isArray(serviceAreas)
        ? serviceAreas
        : [],

    availabilityWindows:
      Array.isArray(availabilityWindows)
        ? availabilityWindows
        : [],

    status: "available",

    isActive: true,
  });

  return resource;
};

export const getResourceByIdService = async ({
  resourceId,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    resourceId,
    "resourceId"
  );

  const resource = await Resource.findById(
    resourceId
  ).populate(
    "ownerOrganization",
    "name organizationType status verificationStatus"
  );

  if (!resource) {
    throw AppError.notFound(
      "Resource not found."
    );
  }

  return resource;
};
export const getResourcesService = async ({
  authenticatedUser,
  query,
}) => {
  const {
    category,
    resourceType,
    status,
    serviceArea,
  } = query;

  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (resourceType) {
    filter.resourceType =
      resourceType;
  }

  if (status) {
    filter.status = status;
  }

  if (serviceArea) {
    filter.serviceAreas =
      serviceArea;
  }

  /*
   * Resource Partner dashboard:
   * only show resources belonging to organizations
   * the logged-in user belongs to.
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.RESOURCE_PARTNER
  ) {
    const organizationIds =
      authenticatedUser.memberships
        ?.filter(
          (membership) =>
            membership.status ===
            ACCOUNT_STATUSES.ACTIVE
        )
        .map(
          (membership) =>
            membership.organizationId
        ) ?? [];

    filter.ownerOrganization = {
      $in: organizationIds,
    };
  }

  return Resource.find(filter)
    .populate(
      "ownerOrganization",
      "name organizationType"
    )
    .sort({
      createdAt: -1,
    });
};
export const updateResourceService = async ({
  resourceId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    resourceId,
    "resourceId"
  );

  const resource = await Resource.findById(
    resourceId
  );

  if (!resource) {
    throw AppError.notFound(
      "Resource not found."
    );
  }

  const managedOrganizationIds =
    getManagedResourcePartnerOrganizationIds(
      authenticatedUser
    );

  const canManage =
    managedOrganizationIds.some(
      (organizationId) =>
        organizationId.toString() ===
        resource.ownerOrganization.toString()
    );

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to modify this resource."
    );
  }

  const allowedFields = [
    "name",
    "description",
    "category",
    "resourceType",
    "totalQuantity",
    "unit",
    "serviceAreas",
    "availabilityWindows",
    "status",
    "isActive",
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      resource[field] =
        payload[field];
    }
  }

  await resource.save();

  return resource;
};
export const deleteResourceService = async ({
  resourceId,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    resourceId,
    "resourceId"
  );

  const resource = await Resource.findById(
    resourceId
  );

  if (!resource) {
    throw AppError.notFound(
      "Resource not found."
    );
  }

  const managedOrganizationIds =
    getManagedResourcePartnerOrganizationIds(
      authenticatedUser
    );

  const canManage =
    managedOrganizationIds.some(
      (organizationId) =>
        organizationId.toString() ===
        resource.ownerOrganization.toString()
    );

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to delete this resource."
    );
  }

  /*
   * Later:
   * check ResourceReservation before deletion.
   */
  await resource.deleteOne();

  return {
    deletedResourceId:
      resource._id,
  };
};