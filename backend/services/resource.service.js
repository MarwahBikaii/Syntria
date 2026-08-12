import mongoose from "mongoose";

import { Resource } from "../models/resource.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
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
export const getMatchingResourcesService = async ({
  initiativeId,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative =
    await Initiative.findById(
      initiativeId
    );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  const results = [];

  for (
    const requirement of
    initiative.resourceRequirements
  ) {
    /*
     * Skip requirements that no longer
     * need resource matching.
     */
    if (
      requirement.status === "cancelled" ||
      requirement.status === "delivered"
    ) {
      continue;
    }

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    if (remainingQuantity <= 0) {
      continue;
    }

    /*
     * Find candidate resources.
     */
    const resources =
      await Resource.find({
        isActive: true,

        status: {
          $in: [
            "available",
            "partially_reserved",
          ],
        },

        category:
          requirement.category,
      }).populate(
        "ownerOrganization",
        "name organizationType"
      );

    const scoredResources = [];

    for (const resource of resources) {
      let score = 0;
      const reasons = [];

      /*
       * ----------------------------------------
       * 1. CATEGORY MATCH
       * ----------------------------------------
       */
      const categoryMatches =
        resource.category
          ?.trim()
          .toLowerCase() ===
        requirement.category
          ?.trim()
          .toLowerCase();

      if (categoryMatches) {
        score += 30;

        reasons.push(
          "Same resource category"
        );
      }

      /*
       * ----------------------------------------
       * 2. UNIT MATCH
       * ----------------------------------------
       */
      const unitMatches =
        resource.unit
          ?.trim()
          .toLowerCase() ===
        requirement.unit
          ?.trim()
          .toLowerCase();

      if (unitMatches) {
        score += 20;

        reasons.push(
          "Matching unit"
        );
      }

      /*
       * If units don't match, I recommend
       * excluding the resource completely.
       */
      if (!unitMatches) {
        continue;
      }

      /*
       * ----------------------------------------
       * 3. SERVICE AREA MATCH
       * ----------------------------------------
       */
      const serviceAreaMatches =
        !requirement.serviceArea ||
        resource.serviceAreas?.some(
          (area) =>
            area
              .trim()
              .toLowerCase() ===
            requirement.serviceArea
              .trim()
              .toLowerCase()
        );

      if (serviceAreaMatches) {
        score += 15;

        reasons.push(
          requirement.serviceArea
            ? "Matching service area"
            : "No specific service area required"
        );
      }

      /*
       * If a service area is explicitly required,
       * reject resources that do not serve it.
       */
      if (
        requirement.serviceArea &&
        !serviceAreaMatches
      ) {
        continue;
      }

      /*
       * ----------------------------------------
       * 4. RESOURCE AVAILABILITY WINDOW
       * ----------------------------------------
       */

      const requiredFrom =
        requirement.requiredFrom;

      const requiredUntil =
        requirement.requiredUntil;

      let matchingAvailabilityWindows = [];

      /*
       * If requirement has no dates,
       * treat current resource availability as valid.
       */
      if (
        !requiredFrom ||
        !requiredUntil
      ) {
        matchingAvailabilityWindows =
          resource.availabilityWindows ?? [];
      } else {
        matchingAvailabilityWindows =
          resource.availabilityWindows?.filter(
            (window) =>
              window.startAt <=
                requiredFrom &&
              window.endAt >=
                requiredUntil &&
              window.availableQuantity > 0
          ) ?? [];
      }

      const hasMatchingWindow =
        !requiredFrom ||
        !requiredUntil ||
        matchingAvailabilityWindows.length > 0;

      if (!hasMatchingWindow) {
        continue;
      }

      score += 15;

      reasons.push(
        "Available during required period"
      );

      /*
       * ----------------------------------------
       * 5. CALCULATE ACTIVE RESERVED QUANTITY
       * ----------------------------------------
       */

      const reservationFilter = {
        resource:
          resource._id,

        status: "active",
      };

      /*
       * Only check date overlap when
       * the requirement has dates.
       */
      if (
        requiredFrom &&
        requiredUntil
      ) {
        reservationFilter.reservedFrom = {
          $lte: requiredUntil,
        };

        reservationFilter.reservedUntil = {
          $gte: requiredFrom,
        };
      }

      const activeReservations =
        await ResourceReservation.find(
          reservationFilter
        ).select("quantity");

      const reservedQuantity =
        activeReservations.reduce(
          (total, reservation) =>
            total +
            reservation.quantity,
          0
        );

      /*
       * Actual available quantity.
       */
      let availableQuantity =
        resource.totalQuantity -
        reservedQuantity;

      availableQuantity =
        Math.max(
          0,
          availableQuantity
        );

      /*
       * ----------------------------------------
       * 6. ALSO RESPECT AVAILABILITY WINDOW
       * QUANTITY
       * ----------------------------------------
       *
       * Resource.totalQuantity may be 10,
       * but the matching window may say only
       * 4 units are available.
       */

      if (
        requiredFrom &&
        requiredUntil &&
        matchingAvailabilityWindows.length >
          0
      ) {
        const windowAvailableQuantity =
          Math.max(
            ...matchingAvailabilityWindows.map(
              (window) =>
                window.availableQuantity
            )
          );

        availableQuantity =
          Math.min(
            availableQuantity,
            windowAvailableQuantity
          );
      }

      /*
       * No usable quantity.
       */
      if (availableQuantity <= 0) {
        continue;
      }

      /*
       * ----------------------------------------
       * 7. QUANTITY SCORE
       * ----------------------------------------
       */

      if (
        availableQuantity >=
        remainingQuantity
      ) {
        score += 20;

        reasons.push(
          "Can satisfy the full remaining quantity"
        );
      } else {
        score += 10;

        reasons.push(
          "Can partially satisfy the remaining quantity"
        );
      }

      /*
       * ----------------------------------------
       * RESULT
       * ----------------------------------------
       */

      scoredResources.push({
        resource,

        matchScore:
          score,

        reasons,

        availability: {
          totalQuantity:
            resource.totalQuantity,

          reservedQuantity,

          availableQuantity,

          remainingRequirementQuantity:
            remainingQuantity,

          canFullySatisfy:
            availableQuantity >=
            remainingQuantity,
        },
      });
    }

    /*
     * Highest score first.
     */
    scoredResources.sort(
      (a, b) => {
        if (
          b.matchScore !==
          a.matchScore
        ) {
          return (
            b.matchScore -
            a.matchScore
          );
        }

        /*
         * Tie breaker:
         * prefer resource with more
         * available quantity.
         */
        return (
          b.availability
            .availableQuantity -
          a.availability
            .availableQuantity
        );
      }
    );

    results.push({
      requirement: {
        _id:
          requirement._id,

        category:
          requirement.category,

        name:
          requirement.name,

        quantityRequired:
          requirement.quantityRequired,

        quantityReserved:
          requirement.quantityReserved,

        remainingQuantity,

        unit:
          requirement.unit,

        requiredFrom:
          requirement.requiredFrom,

        requiredUntil:
          requirement.requiredUntil,

        serviceArea:
          requirement.serviceArea,

        status:
          requirement.status,
      },

      recommendedResources:
        scoredResources,
    });
  }

  return results;
};
/**10 - 3 = 7

min(7, 8) = 7

actual available quantity = 7 */