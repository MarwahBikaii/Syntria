import mongoose from "mongoose";

import { Initiative } from "../models/initiative.model.js";
import { Resource } from "../models/resource.model.js";
import { ResourceRequirement } from "../models/resource-requirement.model.js";
import { ResourceRequest } from "../models/resource-request.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";

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

/*
 * =======================================================
 * CREATE RESOURCE REQUEST
 * =======================================================
 */

export const createResourceRequestService =
  async ({
    initiativeId,
    payload,
    authenticatedUser,
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

    /*
     * Resource requests can only happen
     * after municipality approval.
     */
    if (
      ![
        INITIATIVE_STATUSES.APPROVED,
        INITIATIVE_STATUSES.IN_PROGRESS,
      ].includes(initiative.status)
    ) {
      throw AppError.badRequest(
        "Resources can only be requested for approved or active initiatives."
      );
    }

    /*
     * Only OWNER/ADMIN of lead Community Organization.
     */
    const canRequest =
      authenticatedUser.accountType ===
        USER_ROLES.COMMUNITY_ORGANIZATION &&
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
            membership.organizationId.toString() ===
              initiative.leadOrganization.toString()
        ) ?? false
      );

    if (!canRequest) {
      throw AppError.forbidden(
        "Only the lead Community Organization can request resources."
      );
    }

    const {
      resourceRequirementId,
      resource: resourceId,
      quantityRequested,
      requestedFrom,
      requestedUntil,
      requestNotes,
    } = payload;

    /*
     * ---------------------------------------------------
     * Validate IDs
     * ---------------------------------------------------
     */

    ensureValidObjectId(
      resourceRequirementId,
      "resourceRequirementId"
    );

    ensureValidObjectId(
      resourceId,
      "resource"
    );

    /*
     * ---------------------------------------------------
     * Find ResourceRequirement from separate collection
     * ---------------------------------------------------
     */

    const requirement =
      await ResourceRequirement.findOne({
        _id: resourceRequirementId,

        /*
         * Important:
         * prevents using a requirement belonging
         * to another initiative.
         */
        initiative: initiative._id,
      });

    if (!requirement) {
      throw AppError.notFound(
        "Resource requirement not found for this initiative."
      );
    }

    if (!requirement.isVerifiedRequest) {
      throw AppError.badRequest(
        "This resource requirement has not been verified."
      );
    }

    if (
      [
        "fully_reserved",
        "delivered",
        "cancelled",
      ].includes(requirement.status)
    ) {
      throw AppError.badRequest(
        "This resource requirement is no longer available for resource requests."
      );
    }

    /*
     * ---------------------------------------------------
     * Remaining requirement quantity
     * ---------------------------------------------------
     */

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    const requestedQuantity =
      Number(quantityRequested);

    if (
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0 ||
      requestedQuantity >
        remainingQuantity
    ) {
      throw AppError.badRequest(
        `quantityRequested must be greater than 0 and cannot exceed the remaining required quantity (${remainingQuantity}).`
      );
    }

    /*
     * ---------------------------------------------------
     * Resource validation
     * ---------------------------------------------------
     */

    const resource =
      await Resource.findOne({
        _id: resourceId,

        isActive: true,

        status: {
          $in: [
            "available",
            "partially_reserved",
          ],
        },
      });

    if (!resource) {
      throw AppError.notFound(
        "Resource not found or unavailable."
      );
    }

    /*
     * Requirement and Resource category must match.
     */
    if (
      resource.category
        .trim()
        .toLowerCase() !==
      requirement.category
        .trim()
        .toLowerCase()
    ) {
      throw AppError.badRequest(
        `Resource category must match requirement category "${requirement.category}".`
      );
    }

    /*
     * Requirement and Resource units must match.
     *
     * Do not trust the frontend to choose the unit.
     */
    if (
      resource.unit
        .trim()
        .toLowerCase() !==
      requirement.unit
        .trim()
        .toLowerCase()
    ) {
      throw AppError.badRequest(
        `Resource unit "${resource.unit}" does not match requirement unit "${requirement.unit}".`
      );
    }

    /*
     * ---------------------------------------------------
     * Requested dates
     * ---------------------------------------------------
     */

    const from =
      new Date(requestedFrom);

    const until =
      new Date(requestedUntil);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(until.getTime()) ||
      until <= from
    ) {
      throw AppError.badRequest(
        "Invalid requested availability period."
      );
    }

    /*
     * Request should remain inside the
     * requirement's required period.
     */
    if (
      requirement.requiredFrom &&
      from <
        requirement.requiredFrom
    ) {
      throw AppError.badRequest(
        "requestedFrom cannot be earlier than the resource requirement start date."
      );
    }

    if (
      requirement.requiredUntil &&
      until >
        requirement.requiredUntil
    ) {
      throw AppError.badRequest(
        "requestedUntil cannot be later than the resource requirement end date."
      );
    }

    /*
     * ---------------------------------------------------
     * Create targeted ResourceRequest
     * ---------------------------------------------------
     */

    return ResourceRequest.create({
      initiative:
        initiative._id,

      resourceRequirement:
        requirement._id,

      resource:
        resource._id,

      /*
       * Derived from Resource.
       * Do not trust request body.
       */
      partnerOrganization:
        resource.ownerOrganization,

      requestedBy:
        authenticatedUser._id,

      quantityRequested:
        requestedQuantity,

      /*
       * Derived from requirement.
       */
      unit:
        requirement.unit,

      requestedFrom:
        from,

      requestedUntil:
        until,

      requestNotes:
        requestNotes?.trim() ||
        null,

      status:
        RESOURCE_REQUEST_STATUSES.PENDING,
    });
  };

/*
 * =======================================================
 * REVIEW RESOURCE REQUEST
 * =======================================================
 */

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

    if (
      ![
        RESOURCE_REQUEST_STATUSES.ACCEPTED,
        RESOURCE_REQUEST_STATUSES.REJECTED,
      ].includes(decision)
    ) {
      throw AppError.badRequest(
        "Decision must be accepted or rejected."
      );
    }

    const request =
      await ResourceRequest.findById(
        requestId
      );

    if (!request) {
      throw AppError.notFound(
        "Resource request not found."
      );
    }

    if (
      request.status !==
      RESOURCE_REQUEST_STATUSES.PENDING
    ) {
      throw AppError.badRequest(
        "This resource request has already been processed."
      );
    }

    /*
     * ---------------------------------------------------
     * Resource Partner authorization
     * ---------------------------------------------------
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
            membership.organizationId.toString() ===
              request.partnerOrganization.toString()
        ) ?? false
      );

    if (!canReview) {
      throw AppError.forbidden(
        "You are not authorized to review this resource request."
      );
    }

    /*
     * ---------------------------------------------------
     * REJECT
     * ---------------------------------------------------
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

      await request.save();

      return {
        request,
        reservation: null,
      };
    }

    /*
     * ---------------------------------------------------
     * ACCEPT
     * ---------------------------------------------------
     */

    const initiative =
      await Initiative.findById(
        request.initiative
      );

    if (!initiative) {
      throw AppError.notFound(
        "Initiative not found."
      );
    }

    /*
     * ResourceRequirement is now independent.
     */
    const requirement =
      await ResourceRequirement.findOne({
        _id:
          request.resourceRequirement,

        initiative:
          initiative._id,
      });

    if (!requirement) {
      throw AppError.notFound(
        "Referenced resource requirement no longer exists."
      );
    }

    if (
      requirement.status ===
        "cancelled" ||
      requirement.status ===
        "delivered"
    ) {
      throw AppError.conflict(
        "This resource requirement can no longer receive reservations."
      );
    }

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    if (
      request.quantityRequested >
      remainingQuantity
    ) {
      throw AppError.conflict(
        `Requested quantity exceeds the remaining requirement. Remaining quantity: ${remainingQuantity}.`
      );
    }

    /*
     * ---------------------------------------------------
     * Re-check Resource
     *
     * Resource state may have changed since request
     * submission.
     * ---------------------------------------------------
     */

    const resource =
      await Resource.findOne({
        _id:
          request.resource,

        isActive: true,

        status: {
          $in: [
            "available",
            "partially_reserved",
          ],
        },
      });

    if (!resource) {
      throw AppError.conflict(
        "The requested resource is no longer available."
      );
    }

    /*
     * ---------------------------------------------------
     * Create reservation
     * ---------------------------------------------------
     */

    const reservation =
      await ResourceReservation.create({
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

        /*
         * ResourceRequest itself currently has
         * no agreed price.
         *
         * ContributionOffer reservations can
         * populate these values.
         */
        agreedUnitPrice:
          null,

        agreedAdditionalCost:
          0,

        agreedTotalCost:
          null,

        currency:
          requirement.currency ||
          "USD",

        reservedBy:
          authenticatedUser._id,

        status:
          "active",
      });

    /*
     * ---------------------------------------------------
     * Update ResourceRequirement
     * ---------------------------------------------------
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

    /*
     * ---------------------------------------------------
     * Update ResourceRequest
     * ---------------------------------------------------
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

    await requirement.save();
    await request.save();

    return {
      request,
      reservation,
      requirement,
    };
  };