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

//During the required period, what is the 
// highest quantity of this resource that 
// is already reserved at the same time?
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
      //take start as later , to ensure overlapping detection
        ? reservationStart
        : requiredFrom;

    const endAt =
      reservationEnd < requiredUntil
        ? reservationEnd
      //take end as earlier , to detect unavailability of resources early
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



export const getMatchingResourcesService =
  async ({
    resourceRequirementId,
    authenticatedUser,
  }) => {
  

    ensureValidObjectId(
      resourceRequirementId,
      "resourceRequirementId"
    );

  

    const requirement =
      await ResourceRequirement.findById(
        resourceRequirementId
      );

    if (!requirement) {
      throw AppError.notFound(
        "Resource requirement not found."
      );
    }

  

    const initiative =
      await Initiative.findById(
        requirement.initiative
      );

    if (!initiative) {
      throw AppError.notFound(
        "Initiative associated with this resource requirement was not found."
      );
    }

    
    const initiativeId =
      initiative._id;

    const municipalityId =
      initiative.municipality;

    const leadOrganizationId =
      initiative.leadOrganization;

 

    let canViewMatches = false;

    /*
     * Municipality user
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
              municipalityId.toString()
        ) ?? false;
    }

    /*
     * Community Organization user
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
              leadOrganizationId.toString()
        ) ?? false;
    }

    if (!canViewMatches) {
      throw AppError.forbidden(
        "You are not authorized to find matching resources for this initiative."
      );
    }

    /*
     * ---------------------------------------------------
     * Initiative status validation
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
     * Requirement must be municipality verified
     * ---------------------------------------------------
     */

    if (
      requirement.isVerifiedRequest !== true
    ) {
      throw AppError.badRequest(
        "The resource requirement must be verified before resources can be matched."
      );
    }

    /*
     * ---------------------------------------------------
     * Requirement must still need resources
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
     * Calculate remaining required quantity
     *
     * Example:
     *
     * quantityRequired = 5
     * quantityReserved = 3
     *
     * remainingQuantity = 2
     * ---------------------------------------------------
     */

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;



     //already checked if the requirment is fully reserved, meaning reserved=required, don't find match

     //double checking
   if (remainingQuantity <= 0) {
      throw AppError.conflict(
        "This resource requirement is already fully reserved."
      );
    }

    /*
     * ---------------------------------------------------
     * Required dates
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
     * Find eligible Resource Partner organizations
     *
     * Resource must belong to:
     *
     * - Resource Partner
     * - active organization
     * - verified organization
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
     * Resource base matching
     * ---------------------------------------------------
     *
     * Match:
     *
     * category
     * unit
     * service area
     * dates
     * active status
     * Resource Partner
     * ---------------------------------------------------
     */

    const resourceFilter = {
      ownerOrganization: {
        $in: eligiblePartnerIds,
      },

      category:
        requirement.category,

      unit:
        requirement.unit,

      isActive: true,

      status: {
        $in: [
          "available",
          "partially_reserved",
        ],
      },

 
      /*
       * Resource must contain at least one window
       * that covers the FULL requirement period.
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
     * ---------------------------------------------------
     */

    if (requirement.serviceArea) {
      resourceFilter.serviceAreas =
        requirement.serviceArea;
    }

    /*
     * ---------------------------------------------------
     * Find initial Resource candidates
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
     * Get candidate Resource IDs
     * ---------------------------------------------------
     */

    const candidateResourceIds =
      candidateResources.map(
        (resource) =>
          resource._id
      );
      // resource=> return resource.id

    /*
     * ---------------------------------------------------
     * Find active reservations overlapping
     * requirement period
     *
     * Overlap:
     *
     * reservation start < required end
     * reservation end   > required start
     * ---------------------------------------------------
     */

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
     * Build final matches
     * ---------------------------------------------------
     */

    const matches = [];

    for (
      const resource
      of candidateResources
    ) {
      /*
       * Find windows covering the complete
       * ResourceRequirement period.
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
       * If multiple windows cover the requirement,
       * select highest available capacity.
       */
      const windowCapacity =
        Math.max(
          ...coveringWindows.map(
            (window) =>
              window.availableQuantity
          )
        );

      /*
       * Never consider capacity higher than
       * total Resource inventory.
       */
      const effectiveCapacity =
        Math.min(
          resource.totalQuantity,
          windowCapacity
        );

      /*
       * Get existing active reservations
       * for this Resource.
       */
      const reservations =
        reservationsByResource.get(
          resource._id.toString()
        ) ?? [];

      /*
       * Calculate the maximum quantity
       * concurrently reserved.
       */
      //after grouping reservations per resource
      const concurrentlyReserved =
        getMaximumConcurrentReservedQuantity({
          reservations,
          requiredFrom,
          requiredUntil,
        });

      /*
       * Actual remaining availability.
       */
      const availableQuantity =
        Math.max(
          0,
          effectiveCapacity -
            concurrentlyReserved
        );

      /*
       * Resource currently has no capacity.
       */
      if (
        availableQuantity <= 0
      ) {
        continue;
      }

      /*
       * Can this Resource satisfy everything
       * still needed?
       */
      const canFullySatisfy =
        availableQuantity >=
        remainingQuantity;

      /*
       * -------------------------------------------------
       * Matching score
       *
       * Full match:
       * 100
       *
       * Partial:
       * 50 - 99 depending on available quantity.
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

        /*
         * Useful relationship information.
         */
        initiative: {
          _id:
            initiativeId,

          municipality:
            municipalityId,

          leadOrganization:
            leadOrganizationId,
        },

        resourceRequirement: {
          _id:
            requirement._id,

          name:
            requirement.name,

          category:
            requirement.category,

          unit:
            requirement.unit,

          serviceArea:
            requirement.serviceArea,

          status:
            requirement.status,
        },

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
     * Rank matching Resources
     *
     * 1. Full matches first
     * 2. Higher match score
     * 3. Higher available quantity
     * ---------------------------------------------------
     */

    matches.sort(
      (a, b) => {
        if (
          a.canFullySatisfy !==
          b.canFullySatisfy
        ) {
          return (
            Number(
              b.canFullySatisfy
            ) -
            Number(
              a.canFullySatisfy
            )
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
  //breakdown example
  /**INITIATIVE REQUIREMENT
Needs originally:      5 kits
Already covered:       3 kits
Still needs:           2 kits

CANDIDATE RESOURCE
Capacity during dates: 10 kits
Already booked:        4 kits
Still available:       6 kits */