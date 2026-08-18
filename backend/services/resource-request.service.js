import mongoose from "mongoose";

import { Initiative } from "../models/initiative.model.js";
import { Resource } from "../models/resource.model.js";
import { ResourceRequirement } from "../models/resource-requirement.model.js";
import { ResourceRequest } from "../models/resource-request.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
import {getMatchingResourcesService} from "./resource.service.js"
import {
  ACCOUNT_STATUSES,
  INITIATIVE_STATUSES,
  RESOURCE_REQUEST_STATUSES,
  USER_ROLES,
  USER_ROLES_IN_ORGANIZATION,
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";

/*
 * -------------------------------------------------------
 * Helpers
 * -------------------------------------------------------
 */

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

const getAvailableResourceQuantity = async ({
  resource,
  requiredFrom,
  requiredUntil,
  session = null,
}) => {
  const from = new Date(requiredFrom);
  const until = new Date(requiredUntil);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(until.getTime()) ||
    until <= from
  ) {
    throw AppError.badRequest(
      "Invalid resource availability period."
    );
  }

  /*
   * Find availability windows that cover
   * the ENTIRE requested period.
   */
  const coveringWindows =
    resource.availabilityWindows.filter(
      (window) =>
        new Date(window.startAt) <= from &&
        new Date(window.endAt) >= until &&
        window.availableQuantity > 0
    );

  if (coveringWindows.length === 0) {
    return 0;
  }

  /*
   * Same logic used in matching service.
   */
  const windowCapacity =
    Math.max(
      ...coveringWindows.map(
        (window) =>
          window.availableQuantity
      )
    );

  const effectiveCapacity =
    Math.min(
      resource.totalQuantity,
      windowCapacity
    );

  /*
   * Find reservations overlapping
   * the requested period.
   */
  let reservationQuery =
    ResourceReservation.find({
      resource:
        resource._id,

      status:
        "active",

      reservedFrom: {
        $lt: until,
      },

      reservedUntil: {
        $gt: from,
      },
    })
      .select(
        "quantity reservedFrom reservedUntil"
      )
      .lean();

  if (session) {
    reservationQuery =
      reservationQuery.session(
        session
      );
  }

  const reservations =
    await reservationQuery;

  const concurrentlyReserved =
    getMaximumConcurrentReservedQuantity({
      reservations,
      requiredFrom: from,
      requiredUntil: until,
    });

  return Math.max(
    0,
    effectiveCapacity -
      concurrentlyReserved
  );
};

export const reviewResourceRequestService =
  async ({
    requestId,
    decision,
    notes,
    authenticatedUser,
  }) => {
    ensureValidObjectId(
      requestId,
      "requestId"
    );

    /*
     * ---------------------------------------------------
     * Validate decision
     * ---------------------------------------------------
     */

    const allowedDecisions = [
      RESOURCE_REQUEST_STATUSES.ACCEPTED,
      RESOURCE_REQUEST_STATUSES.REJECTED,
    ];

    if (
      !allowedDecisions.includes(
        decision
      )
    ) {
      throw AppError.badRequest(
        "Decision must be accepted or rejected."
      );
    }

    //active account check
    if (
      authenticatedUser.status !==
      ACCOUNT_STATUSES.ACTIVE
    ) {
      throw AppError.forbidden(
        "Your account is not active."
      );
    }

    const session =
      await mongoose.startSession();

    let result;

    try {
      await session.withTransaction(
        async () => {
          /*
           * -----------------------------------------------
           * Load request inside transaction
           * -----------------------------------------------
           */

          const request =
            await ResourceRequest.findById(
              requestId
            ).session(session);

          if (!request) {
            throw AppError.notFound(
              "Resource request not found."
            );
          }

          /*
           * Only pending requests can be reviewed.
           */
          if (
            request.status !==
            RESOURCE_REQUEST_STATUSES.PENDING
          ) {
            throw AppError.conflict(
              "This resource request has already been processed."
            );
          }

          /*
           * -----------------------------------------------
           * Resource Partner authorization
           * -----------------------------------------------
           */

          const canReview =
            authenticatedUser.accountType ===
              USER_ROLES.RESOURCE_PARTNER &&
            (
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
                    request.partnerOrganization
                      .toString()
              ) ?? false
            );

          if (!canReview) {
            throw AppError.forbidden(
              "You are not authorized to review this resource request."
            );
          }

          /*
           * -----------------------------------------------
           * REJECT
           * -----------------------------------------------
           */

          if (
            decision ===
            RESOURCE_REQUEST_STATUSES.REJECTED
          ) {
            request.status =
              RESOURCE_REQUEST_STATUSES.REJECTED;

            request.review = {
              reviewedBy:
                authenticatedUser._id,

              notes:
                notes?.trim() ||
                null,

              reviewedAt:
                new Date(),
            };

            await request.save({
              session,
            });

            result = {
              request,
              reservation: null,
            };

            return;
          }

          /*
           * ===============================================
           * ACCEPT
           * ===============================================
           */

          /*
           * -----------------------------------------------
           * Re-check Initiative
           * -----------------------------------------------
           */

          const initiative =
            await Initiative.findById(
              request.initiative
            ).session(session);

          if (!initiative) {
            throw AppError.notFound(
              "Initiative not found."
            );
          }

          /*
           * Matching was only allowed for these
           * initiative states.
           */
          if (
            ![
              INITIATIVE_STATUSES.APPROVED,
              INITIATIVE_STATUSES.IN_PROGRESS,
            ].includes(
              initiative.status
            )
          ) {
            throw AppError.conflict(
              "This initiative can no longer receive resource reservations."
            );
          }

          /*
           * -----------------------------------------------
           * Re-check ResourceRequirement
           * -----------------------------------------------
           */

          const requirement =
            await ResourceRequirement.findOne({
              _id:
                request.resourceRequirement,

              initiative:
                initiative._id,
            }).session(session);

          if (!requirement) {
            throw AppError.notFound(
              "Referenced resource requirement no longer exists."
            );
          }

          /*
           * Requirement must still be valid.
           */
          if (
            [
              "cancelled",
              "delivered",
              "fully_reserved",
            ].includes(
              requirement.status
            )
          ) {
            throw AppError.conflict(
              "This resource requirement can no longer receive reservations."
            );
          }

          if (
            requirement.isVerifiedRequest !==
            true
          ) {
            throw AppError.conflict(
              "This resource requirement is no longer verified."
            );
          }

          /*
           * -----------------------------------------------
           * Request must still represent the same
           * requirement period
           * -----------------------------------------------
           */

          if (
            !requirement.requiredFrom ||
            !requirement.requiredUntil
          ) {
            throw AppError.conflict(
              "The resource requirement no longer has a valid required period."
            );
          }

          const requirementFrom =
            new Date(
              requirement.requiredFrom
            );

          const requirementUntil =
            new Date(
              requirement.requiredUntil
            );

          const requestFrom =
            new Date(
              request.requestedFrom
            );

          const requestUntil =
            new Date(
              request.requestedUntil
            );

          if (
            requirementFrom.getTime() !==
              requestFrom.getTime() ||
            requirementUntil.getTime() !==
              requestUntil.getTime()
          ) {
            throw AppError.conflict(
              "The resource requirement dates changed after this request was submitted. Please create a new resource request."
            );
          }

          /*
           * -----------------------------------------------
           * Remaining quantity
           * -----------------------------------------------
           */

          const remainingQuantity =
            requirement.quantityRequired -
            requirement.quantityReserved;

          if (
            remainingQuantity <= 0
          ) {
            throw AppError.conflict(
              "This resource requirement is already fully reserved."
            );
          }

          if (
            request.quantityRequested >
            remainingQuantity
          ) {
            throw AppError.conflict(
              `The request quantity exceeds the remaining requirement. Only ${remainingQuantity} ${requirement.unit} is still required.`
            );
          }

          /*
           * -----------------------------------------------
           * Prevent duplicate reservation for same request
           * -----------------------------------------------
           */

          const existingReservation =
            await ResourceReservation.findOne({
              resourceRequest:
                request._id,
            }).session(session);

          if (existingReservation) {
            throw AppError.conflict(
              "A reservation has already been created from this resource request."
            );
          }

          /*
           * -----------------------------------------------
           * Re-check Resource
           * -----------------------------------------------
           */

          const resource =
            await Resource.findOne({
              _id:
                request.resource,

              ownerOrganization:
                request.partnerOrganization,

              isActive:
                true,

              status: {
                $in: [
                  "available",
                  "partially_reserved",
                ],
              },
            }).session(session);

          if (!resource) {
            throw AppError.conflict(
              "The requested resource is no longer available from this resource partner."
            );
          }

          /*
           * Resource properties may have changed while
           * request was pending.
           * -----------------------------------------------
           */

          if (
            resource.category !==
            requirement.category
          ) {
            throw AppError.conflict(
              "The resource category no longer matches the resource requirement."
            );
          }

          if (
            resource.unit !==
            requirement.unit
          ) {
            throw AppError.conflict(
              "The resource unit no longer matches the resource requirement."
            );
          }

          if (
            requirement.serviceArea &&
            !resource.serviceAreas.includes(
              requirement.serviceArea
            )
          ) {
            throw AppError.conflict(
              "The resource no longer serves the required service area."
            );
          }

          /*
           * -----------------------------------------------
           * Recalculate current availability
           * -----------------------------------------------
           */

          const availableQuantity =
            await getAvailableResourceQuantity({
              resource,
              requiredFrom:
                request.requestedFrom,

              requiredUntil:
                request.requestedUntil,

              session,
            });

          if (
            availableQuantity <= 0
          ) {
            throw AppError.conflict(
              "The requested resource no longer has available capacity for this period."
            );
          }

          if (
            request.quantityRequested >
            availableQuantity
          ) {
            throw AppError.conflict(
              `The requested resource now has only ${availableQuantity} ${requirement.unit} available for this period.`
            );
          }

          /*
           * -----------------------------------------------
           * Create ResourceReservation
           * -----------------------------------------------
           */

          const reservation =
            new ResourceReservation({
              initiative:
                initiative._id,

              resourceRequirement:
                requirement._id,

              resource:
                resource._id,

              /*
               * Exactly one reservation source.
               */
              resourceRequest:
                request._id,

              contributionOffer:
                null,

              contributionOfferItemId:
                null,

              quantity:
                request.quantityRequested,

              unit:
                requirement.unit,

              reservedFrom:
                request.requestedFrom,

              reservedUntil:
                request.requestedUntil,

              agreedUnitPrice:
                null,

              agreedAdditionalCost:
                0,

              agreedTotalCost:
                null,

              currency:
                requirement.currency ||
                "USD",

              
             //The Resource Partner user accepting the request
               
              reservedBy:
                authenticatedUser._id,

              status:
                "active",
            });

          await reservation.save({
            session,
          });

          /*
           * -----------------------------------------------
           * Update ResourceRequirement reserved quantity
           * -----------------------------------------------
           */

          requirement.quantityReserved +=
            request.quantityRequested;

          if (
            requirement.quantityReserved >=
            requirement.quantityRequired
          ) {
            requirement.quantityReserved =
              requirement.quantityRequired;

            requirement.status =
              "fully_reserved";
          } else {
            requirement.status =
              "partially_met";
          }

          await requirement.save({
            session,
          });

          /*
           * -----------------------------------------------
           * Update ResourceRequest
           * -----------------------------------------------
           */

          request.status =
            RESOURCE_REQUEST_STATUSES.ACCEPTED;

          request.review = {
            reviewedBy:
              authenticatedUser._id,

            notes:
              notes?.trim() ||
              null,

            reviewedAt:
              new Date(),
          };

          await request.save({
            session,
          });

          result = {
            request,
            reservation,
            requirement,

            availability: {
              availableBeforeReservation:
                availableQuantity,

              reservedQuantity:
                request.quantityRequested,

              availableAfterReservation:
                Math.max(
                  0,
                  availableQuantity -
                    request.quantityRequested
                ),
            },
          };
        }
      );

      return result;
    } finally {
      await session.endSession();
    }
  };


  export const sendrequestforMatchingResourcesService =
  async ({
    resourceRequirementId,
    resourceId,
    quantityRequested,
    notes,
    authenticatedUser,
  }) => {


    ensureValidObjectId(
      resourceRequirementId,
      "resourceRequirementId"
    );

    ensureValidObjectId(
      resourceId,
      "resourceId"
    );

    /*
     * ---------------------------------------------------
     * Validate requested quantity
     * ---------------------------------------------------
     */

    const requestedQuantity =
      Number(quantityRequested);

    if (
      !Number.isFinite(
        requestedQuantity
      ) ||
      requestedQuantity <= 0
    ) {
      throw AppError.badRequest(
        "quantityRequested must be greater than 0."
      );
    }

    /*
     * --------------------------------------------------
     * getMatchingResourcesService calculates current:
     *
     * - remaining requirement quantity
     * - availability windows
     * - active reservations
     * - concurrent reserved quantity
     * - available resource quantity
     * --------------------------------------------------
     */

    const matches =
      await getMatchingResourcesService({
        resourceRequirementId,
        authenticatedUser,
      });

    /*
     * ---------------------------------------------------
     * Find requested Resource inside CURRENT matches
     * ---------------------------------------------------
     */

    const match =
      matches.find(
        (item) =>
          item.resource._id.toString() ===
          resourceId.toString()
      );

    if (!match) {
      throw AppError.conflict(
        "This resource is no longer a valid match for this resource requirement."
      );
    }

    /*
     * ---------------------------------------------------
     * Maximum quantity that may be requested
     *
     * Example:
     *
     * Resource availability = 8
     * Requirement still needs = 3
     *
     * Maximum request = 3
     * ---------------------------------------------------
     */

    const maxRequestableQuantity =
      Math.min(
        match.availableQuantity,
        match.quantityNeeded
      );

    if (
      maxRequestableQuantity <= 0
    ) {
      throw AppError.conflict(
        "This resource currently has no requestable quantity."
      );
    }

    /*
     * ---------------------------------------------------
     * User may choose a smaller quantity,
     * should not exceed matching result.
     * ---------------------------------------------------
     */

    if (
      requestedQuantity >
      maxRequestableQuantity
    ) {
      throw AppError.conflict(
        `You can request a maximum of ${maxRequestableQuantity} ${match.resourceRequirement.unit} from this resource.`
      );
    }

    /*
     * ---------------------------------------------------
     * Prevent duplicate pending request
     * ---------------------------------------------------
     */

    const existingPendingRequest =
      await ResourceRequest.findOne({
        resourceRequirement:
          resourceRequirementId,

        resource:
          resourceId,

        status:
          RESOURCE_REQUEST_STATUSES.PENDING,
      });

    if (existingPendingRequest) {
      throw AppError.conflict(
        "A pending request already exists for this resource and resource requirement."
      );
    }

    /*
     * ---------------------------------------------------
     * Resource owner = Resource Partner receiving request
     *
     * ownerOrganization is populated inside the
     * matching service.
     * ---------------------------------------------------
     */

    const partnerOrganizationId =
      match.resource
        .ownerOrganization?._id ??
      match.resource
        .ownerOrganization;

    if (!partnerOrganizationId) {
      throw AppError.conflict(
        "The matched resource does not have a valid owner organization."
      );
    }

    /*
     * ---------------------------------------------------
     * Create ResourceRequest
     * ---------------------------------------------------
     */

    const request =
      await ResourceRequest.create({
        initiative:
          match.initiative._id,

        resourceRequirement:
          match.resourceRequirement._id,

        resource:
          match.resource._id,

        partnerOrganization:
          partnerOrganizationId,

        requestedBy:
          authenticatedUser._id,

        quantityRequested:
          requestedQuantity,

        unit:
          match.resourceRequirement.unit,

        requestedFrom:
          match.availability.requiredFrom,

        requestedUntil:
          match.availability.requiredUntil,

        requestNotes:
          notes?.trim() || null,

        status:
          RESOURCE_REQUEST_STATUSES.PENDING,
      });

    return {
      request,

      matching: {
        availableQuantity:
          match.availableQuantity,

        quantityNeeded:
          match.quantityNeeded,

        maxRequestableQuantity,

        quantityRequested:
          requestedQuantity,
      },
    };
  };
  