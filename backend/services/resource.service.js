import mongoose from "mongoose";

import { Resource } from "../models/resource.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  USER_ROLES_IN_ORGANIZATION,
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  VERIFICATION_STATUSES,
  INITIATIVE_STATUSES
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";
import { ResourceRequirement } from "../models/resource-requirement.model.js";
import { Initiative } from "../models/initiative.model.js";
import  Organization  from "../models/organizationModel.js";


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

/*

 * Reservation A:
 * Sept 1 -> Sept 5 = 3
 *
 * Reservation B:
 * Sept 6 -> Sept 10 = 3
 
 */

const getMaximumConcurrentReservedQuantity = ({
  reservations,
  requiredFrom,
  requiredUntil,
}) => {
  const events = [];

  for (const reservation of reservations) {
    /*
     * Clip reservation to the requirement period.
     */
    const reservationStart =
      new Date(reservation.reservedFrom);

    const reservationEnd =
      new Date(reservation.reservedUntil);

    const startAt =
      reservationStart > requiredFrom
        ? reservationStart
        : requiredFrom;

    const endAt =
      reservationEnd < requiredUntil
        ? reservationEnd
        : requiredUntil;

    /*
     * No actual overlap.
     */
    if (endAt <= startAt) {
      continue;
    }

    events.push({
      time: startAt.getTime(),
      quantity: reservation.quantity,
    });

    events.push({
      time: endAt.getTime(),
      quantity: -reservation.quantity,
    });
  }

  /*
   * At exactly the same timestamp:
   *
   * process reservation ending before
   * another reservation starting.
   */
  events.sort((a, b) => {
    if (a.time === b.time) {
      return a.quantity - b.quantity;
    }

    return a.time - b.time;
  });

  let currentlyReserved = 0;
  let maximumReserved = 0;

  for (const event of events) {
    currentlyReserved +=
      event.quantity;

    maximumReserved = Math.max(
      maximumReserved,
      currentlyReserved
    );
  }

  return maximumReserved;
};


/*
 * -------------------------------------------------------
 * GET MATCHING RESOURCES
 * -------------------------------------------------------
 */

export const getMatchingResourcesService =
  async ({
    initiativeId,

    /*
     * Your current controller sends:
     *
     * resourceRequirement:
     * req.params.resourceRequirementId
     */
    resourceRequirement,

    authenticatedUser,
  }) => {
    /*
     * ---------------------------------------------------
     * Validate IDs
     * ---------------------------------------------------
     */

    ensureValidObjectId(
      initiativeId,
      "initiativeId"
    );

    ensureValidObjectId(
      resourceRequirement,
      "resourceRequirementId"
    );


    /*
     * ---------------------------------------------------
     * Find Initiative
     * ---------------------------------------------------
     */

    const initiative =
      await Initiative.findById(
        initiativeId
      );

    if (!initiative) {
      throw AppError.notFound(
        "Initiative not found."
      );
    }


    /*
     * ---------------------------------------------------
     * Authorization
     *
     * Municipality OWNER / ADMIN
     * OR
     * Lead Community Organization OWNER / ADMIN
     * ---------------------------------------------------
     */

    let canViewMatches = false;

    /*
     * Municipality
     */
    if (
      authenticatedUser.accountType ===
      USER_ROLES.MUNICIPALITY
    ) {
      canViewMatches =
        authenticatedUser.memberships?.some(
          (membership) =>
            membership.status ===
              ACCOUNT_STATUSES.ACTIVE &&

            [
              USER_ROLES_IN_ORGANIZATION.OWNER,
              USER_ROLES_IN_ORGANIZATION.ADMIN,
            ].includes(
              membership.role
            ) &&

            membership.organizationId
              .toString() ===
              initiative.municipality
                .toString()
        ) ?? false;
    }


    /*
     * Lead Community Organization
     */
    if (
      authenticatedUser.accountType ===
      USER_ROLES.COMMUNITY_ORGANIZATION
    ) {
      canViewMatches =
        authenticatedUser.memberships?.some(
          (membership) =>
            membership.status ===
              ACCOUNT_STATUSES.ACTIVE &&

            [
              USER_ROLES_IN_ORGANIZATION.OWNER,
              USER_ROLES_IN_ORGANIZATION.ADMIN,
            ].includes(
              membership.role
            ) &&

            membership.organizationId
              .toString() ===
              initiative.leadOrganization
                .toString()
        ) ?? false;
    }


    if (!canViewMatches) {
      throw AppError.forbidden(
        "You are not authorized to find matching resources for this initiative."
      );
    }


    /*
     * ---------------------------------------------------
     * Initiative must already be approved.
     *
     * Matching should not happen for:
     *
     * draft
     * submitted
     * changes_requested
     * rejected
     * cancelled
     * ---------------------------------------------------
     */

    const matchingAllowedStatuses = [
      INITIATIVE_STATUSES.APPROVED,
      INITIATIVE_STATUSES.IN_PROGRESS,
    ];

    if (
      !matchingAllowedStatuses.includes(
        initiative.status
      )
    ) {
      throw AppError.badRequest(
        "Resources can only be matched for approved or in-progress initiatives."
      );
    }


    /*
     * ---------------------------------------------------
     * Find standalone ResourceRequirement
     *
     * IMPORTANT:
     *
     * We intentionally query:
     *
     * {
     *   _id: resourceRequirement,
     *   initiative: initiativeId
     * }
     *
     * This guarantees the requirement actually belongs
     * to the Initiative passed in the URL.
     * ---------------------------------------------------
     */

    const requirement =
      await ResourceRequirement.findOne({
        _id: resourceRequirement,
        initiative: initiativeId,
      });

    if (!requirement) {
      throw AppError.notFound(
        "Resource requirement was not found for this initiative."
      );
    }


    /*
     * ---------------------------------------------------
     * Requirement must be verified
     * ---------------------------------------------------
     */

    if (
      requirement.isVerifiedRequest !==
      true
    ) {
      throw AppError.badRequest(
        "The resource requirement must be verified before resources can be matched."
      );
    }


    /*
     * ---------------------------------------------------
     * Do not match already finished/cancelled requirements
     * ---------------------------------------------------
     */

    if (
      [
        "fully_reserved",
        "delivered",
        "cancelled",
      ].includes(requirement.status)
    ) {
      throw AppError.conflict(
        "This resource requirement does not currently require additional matching."
      );
    }


    /*
     * ---------------------------------------------------
     * Remaining quantity
     *
     * Example:
     *
     * required = 10
     * reserved = 4
     *
     * still needed = 6
     * ---------------------------------------------------
     */

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    if (remainingQuantity <= 0) {
      throw AppError.conflict(
        "This resource requirement is already fully reserved."
      );
    }


    /*
     * ---------------------------------------------------
     * Required dates
     *
     * Matching requires a defined period because resource
     * availability and reservations are date-sensitive.
     * ---------------------------------------------------
     */

    if (
      !requirement.requiredFrom ||
      !requirement.requiredUntil
    ) {
      throw AppError.badRequest(
        "The resource requirement must define requiredFrom and requiredUntil before matching resources."
      );
    }


    const requiredFrom =
      new Date(
        requirement.requiredFrom
      );

    const requiredUntil =
      new Date(
        requirement.requiredUntil
      );


    /*
     * ---------------------------------------------------
     * Only active + verified Resource Partner orgs
     * ---------------------------------------------------
     */

    const eligiblePartnerIds =
      await Organization.find({
        organizationType:
          ORGANIZATION_TYPES.RESOURCE_PARTNER,

        status:
          ORGANIZATION_STATUSES.ACTIVE,

        verificationStatus:
          VERIFICATION_STATUSES.VERIFIED,
      }).distinct("_id");


    if (
      eligiblePartnerIds.length === 0
    ) {
      return [];
    }


    /*
     * ---------------------------------------------------
     * Base Resource matching filter
     * ---------------------------------------------------
     */

    const resourceFilter = {
      ownerOrganization: {
        $in: eligiblePartnerIds,
      },

      /*
       * Exact requirement category.
       */
      category:
        requirement.category,

      /*
       * Unit must match.
       *
       * Example:
       * requirement.unit = "vehicle"
       * resource.unit = "vehicle"
       */
      unit:
        requirement.unit,

      /*
       * Resource must be usable.
       */
      isActive: true,

      status: {
        $in: [
          "available",
          "partially_reserved",
        ],
      },

      /*
       * At least one availability window must cover
       * the ENTIRE required period.
       */
      availabilityWindows: {
        $elemMatch: {
          startAt: {
            $lte: requiredFrom,
          },

          endAt: {
            $gte: requiredUntil,
          },

          availableQuantity: {
            $gt: 0,
          },
        },
      },
    };


    /*
     * ---------------------------------------------------
     * Service area
     *
     * If the requirement specifies Tripoli:
     *
     * Resource.serviceAreas must contain Tripoli.
     * ---------------------------------------------------
     */

    if (requirement.serviceArea) {
      resourceFilter.serviceAreas =
        requirement.serviceArea;
    }


    /*
     * ---------------------------------------------------
     * Get candidate Resources
     * ---------------------------------------------------
     */

    const candidateResources =
      await Resource.find(
        resourceFilter
      )
        .populate(
          "ownerOrganization",
          "name organizationType status verificationStatus"
        )
        .lean();


    if (
      candidateResources.length === 0
    ) {
      return [];
    }


    /*
     * ---------------------------------------------------
     * Load ACTIVE reservations for all candidate resources.
     *
     * One query instead of one query per Resource.
     *
     * Date overlap rule:
     *
     * reservation.start < requiredUntil
     * reservation.end   > requiredFrom
     * ---------------------------------------------------
     */

    const candidateResourceIds =
      candidateResources.map(
        (resource) =>
          resource._id
      );


    const activeReservations =
      await ResourceReservation.find({
        resource: {
          $in: candidateResourceIds,
        },

        status: "active",

        reservedFrom: {
          $lt: requiredUntil,
        },

        reservedUntil: {
          $gt: requiredFrom,
        },
      })
        .select(
          "resource quantity reservedFrom reservedUntil"
        )
        .lean();


    /*
     * ---------------------------------------------------
     * Group reservations by Resource
     * ---------------------------------------------------
     */

    const reservationsByResource =
      new Map();


    for (
      const reservation
      of activeReservations
    ) {
      const resourceId =
        reservation.resource.toString();

      if (
        !reservationsByResource.has(
          resourceId
        )
      ) {
        reservationsByResource.set(
          resourceId,
          []
        );
      }

      reservationsByResource
        .get(resourceId)
        .push(reservation);
    }


    /*
     * ---------------------------------------------------
     * Calculate actual availability + match score
     * ---------------------------------------------------
     */

    const matches = [];


    for (
      const resource
      of candidateResources
    ) {
      /*
       * Find windows that cover the entire
       * requirement period.
       */
      const coveringWindows =
        resource.availabilityWindows.filter(
          (window) =>
            new Date(
              window.startAt
            ) <= requiredFrom &&

            new Date(
              window.endAt
            ) >= requiredUntil &&

            window.availableQuantity > 0
        );


      if (
        coveringWindows.length === 0
      ) {
        continue;
      }


      /*
       * If multiple windows cover the same period,
       * use the window with the highest capacity.
       */
      const windowCapacity =
        Math.max(
          ...coveringWindows.map(
            (window) =>
              window.availableQuantity
          )
        );


      /*
       * Never allow window capacity to exceed
       * Resource.totalQuantity.
       */
      const effectiveCapacity =
        Math.min(
          resource.totalQuantity,
          windowCapacity
        );


      /*
       * Active reservations for this resource.
       */
      const reservations =
        reservationsByResource.get(
          resource._id.toString()
        ) ?? [];


      /*
       * Calculate peak quantity already reserved
       * during the requirement period.
       */
      const concurrentlyReserved =
        getMaximumConcurrentReservedQuantity({
          reservations,
          requiredFrom,
          requiredUntil,
        });


      /*
       * Actual quantity still available.
       */
      const availableQuantity =
        Math.max(
          0,
          effectiveCapacity -
            concurrentlyReserved
        );


      /*
       * Resource has no remaining capacity.
       */
      if (
        availableQuantity <= 0
      ) {
        continue;
      }


      /*
       * Can this Resource satisfy the entire
       * remaining requirement?
       */
      const canFullySatisfy =
        availableQuantity >=
        remainingQuantity;


      /*
       * -------------------------------------------------
       * Match score
       *
       * Full availability = 100
       *
       * Partial availability =
       * proportional score between 50-99.
       * -------------------------------------------------
       */

      const matchScore =
        canFullySatisfy
          ? 100
          : Math.round(
              50 +
                (
                  availableQuantity /
                  remainingQuantity
                ) *
                  49
            );


      matches.push({
        resource,

        matchScore,

        matchType:
          canFullySatisfy
            ? "full"
            : "partial",

        canFullySatisfy,

        quantityRequired:
          requirement.quantityRequired,

        quantityAlreadyReserved:
          requirement.quantityReserved,

        quantityNeeded:
          remainingQuantity,

        availableQuantity,

        currentlyReserved:
          concurrentlyReserved,

        availability: {
          requiredFrom,
          requiredUntil,

          effectiveCapacity,
        },
      });
    }


    /*
     * ---------------------------------------------------
     * Ranking
     *
     * 1. Full matches
     * 2. Highest score
     * 3. Highest available quantity
     * ---------------------------------------------------
     */

    matches.sort(
      (a, b) => {
        if (
          a.canFullySatisfy !==
          b.canFullySatisfy
        ) {
          return Number(
            b.canFullySatisfy
          ) -
            Number(
              a.canFullySatisfy
            );
        }

        if (
          b.matchScore !==
          a.matchScore
        ) {
          return (
            b.matchScore -
            a.matchScore
          );
        }

        return (
          b.availableQuantity -
          a.availableQuantity
        );
      }
    );


    return matches;
  };