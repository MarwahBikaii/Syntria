import mongoose from "mongoose";

import { Initiative } from "../models/initiative.model.js";
import { Resource } from "../models/resource.model.js";
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
            ].includes(membership.role) &&
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
      unit,
      requestedFrom,
      requestedUntil,
      requestNotes,
    } = payload;

    ensureValidObjectId(
      resourceRequirementId,
      "resourceRequirementId"
    );

    ensureValidObjectId(
      resourceId,
      "resource"
    );

    const requirement =
      initiative.resourceRequirements.id(
        resourceRequirementId
      );

    if (!requirement) {
      throw AppError.notFound(
        "Resource requirement not found in this initiative."
      );
    }

    if (!requirement.isVerifiedRequest) {
      throw AppError.badRequest(
        "This resource requirement has not been verified."
      );
    }

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    if (
      Number(quantityRequested) <= 0 ||
      Number(quantityRequested) >
        remainingQuantity
    ) {
      throw AppError.badRequest(
        `quantityRequested must be greater than 0 and cannot exceed the remaining required quantity (${remainingQuantity}).`
      );
    }

    const resource =
      await Resource.findOne({
        _id: resourceId,
        isActive: true,
      });

    if (!resource) {
      throw AppError.notFound(
        "Resource not found or inactive."
      );
    }

    if (
      resource.unit.toLowerCase() !==
      unit?.trim().toLowerCase()
    ) {
      throw AppError.badRequest(
        `Resource unit must be "${resource.unit}".`
      );
    }

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

    return ResourceRequest.create({
      initiative: initiative._id,

      resourceRequirementId:
        requirement._id,

      resource:
        resource._id,

      partnerOrganization:
        resource.ownerOrganization,

      requestedBy:
        authenticatedUser._id,

      quantityRequested,

      unit:
        unit.trim(),

      requestedFrom:
        from,

      requestedUntil:
        until,

      requestNotes:
        requestNotes?.trim() || null,

      status:
        RESOURCE_REQUEST_STATUSES.PENDING,
    });
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
            ].includes(membership.role) &&
            membership.organizationId.toString() ===
              request.partnerOrganization.toString()
        ) ?? false
      );

    if (!canReview) {
      throw AppError.forbidden(
        "You are not authorized to review this resource request."
      );
    }

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
          notes?.trim() || null,
        reviewedAt:
          new Date(),
      };

      await request.save();

      return {
        request,
        reservation: null,
      };
    }

    const initiative =
      await Initiative.findById(
        request.initiative
      );

    if (!initiative) {
      throw AppError.notFound(
        "Initiative not found."
      );
    }

    const requirement =
      initiative.resourceRequirements.id(
        request.resourceRequirementId
      );

    if (!requirement) {
      throw AppError.notFound(
        "Referenced resource requirement no longer exists."
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

    const resource =
      await Resource.findById(
        request.resource
      );

    if (
      !resource ||
      !resource.isActive
    ) {
      throw AppError.conflict(
        "The requested resource is no longer available."
      );
    }

    const reservation =
      await ResourceReservation.create({
        resource:
          resource._id,

        initiative:
          initiative._id,

        contributionOffer:
          null,

        resourceRequest:
          request._id,

        resourceRequirementId:
          requirement._id,

        quantity:
          request.quantityRequested,

        unit:
          request.unit,

        reservedFrom:
          request.requestedFrom,

        reservedUntil:
          request.requestedUntil,

        reservedBy:
          authenticatedUser._id,

        status:
          "active",
      });

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

    request.status =
      RESOURCE_REQUEST_STATUSES.ACCEPTED;

    request.review = {
      reviewedBy:
        authenticatedUser._id,
      notes:
        notes?.trim() || null,
      reviewedAt:
        new Date(),
    };

    await initiative.save();
    await request.save();

    return {
      request,
      reservation,
    };
  };