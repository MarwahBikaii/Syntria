import mongoose from "mongoose";

import { ContributionOffer } from "../models/contribution-offer.model.js";
import { Resource } from "../models/resource.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
import { Initiative } from "../models/initiative.model.js";

import {
  ACCOUNT_STATUSES,
  INITIATIVE_STATUSES,
  OFFER_STATUSES,
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

const getManagedPartnerOrganizations = (user) => {
  return (
    user.memberships?.filter(
      (membership) =>
        membership.status ===
          ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role)
    ) ?? []
  );
};
export const createContributionOfferService = async ({
  initiativeId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  if (
    authenticatedUser.accountType !==
    USER_ROLES.RESOURCE_PARTNER
  ) {
    throw AppError.forbidden(
      "Only Resource Partners can submit contribution offers."
    );
  }

  const initiative = await Initiative.findById(
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
      "Contribution offers can only be submitted to approved or active initiatives."
    );
  }

  const {
    partnerOrganization: requestedPartnerOrganization,
    items,
    organizationNotes,
  } = payload;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw AppError.badRequest(
      "At least one contribution item is required."
    );
  }

  const memberships =
    getManagedPartnerOrganizations(
      authenticatedUser
    );

  if (memberships.length === 0) {
    throw AppError.forbidden(
      "You must be an owner or administrator of a Resource Partner organization."
    );
  }

  let partnerOrganizationId;

  if (memberships.length === 1) {
    partnerOrganizationId =
      memberships[0].organizationId;
  } else {
    if (!requestedPartnerOrganization) {
      throw AppError.badRequest(
        "partnerOrganization is required because you manage multiple organizations."
      );
    }

    ensureValidObjectId(
      requestedPartnerOrganization,
      "partnerOrganization"
    );

    const membership = memberships.find(
      (membership) =>
        membership.organizationId.toString() ===
        requestedPartnerOrganization.toString()
    );

    if (!membership) {
      throw AppError.forbidden(
        "You cannot submit an offer for this organization."
      );
    }

    partnerOrganizationId =
      requestedPartnerOrganization;
  }

  /*
   * Validate every offered item.
   */
  for (const item of items) {
    ensureValidObjectId(
      item.resourceRequirementId,
      "resourceRequirementId"
    );

    ensureValidObjectId(
      item.resource,
      "resource"
    );

    const requirement =
      initiative.resourceRequirements.id(
        item.resourceRequirementId
      );

    if (!requirement) {
      throw AppError.badRequest(
        "One of the selected resource requirements does not belong to this initiative."
      );
    }

    if (!requirement.isVerifiedRequest) {
      throw AppError.badRequest(
        `Resource requirement "${requirement.name}" has not been verified.`
      );
    }

    if (
      !item.quantityOffered ||
      Number(item.quantityOffered) <= 0
    ) {
      throw AppError.badRequest(
        "quantityOffered must be greater than 0."
      );
    }

    if (!item.unit?.trim()) {
      throw AppError.badRequest(
        "Unit is required for every contribution item."
      );
    }

    if (
      !item.availableFrom ||
      !item.availableUntil
    ) {
      throw AppError.badRequest(
        "Availability dates are required."
      );
    }

    const availableFrom =
      new Date(item.availableFrom);

    const availableUntil =
      new Date(item.availableUntil);

    if (
      Number.isNaN(availableFrom.getTime()) ||
      Number.isNaN(availableUntil.getTime()) ||
      availableUntil <= availableFrom
    ) {
      throw AppError.badRequest(
        "Invalid contribution availability period."
      );
    }

    /*
     * Verify the offered Resource really belongs
     * to this Resource Partner organization.
     */
    const resource = await Resource.findOne({
      _id: item.resource,
      ownerOrganization:
        partnerOrganizationId,
      isActive: true,
    });

    if (!resource) {
      throw AppError.badRequest(
        "One of the offered resources does not belong to your Resource Partner organization or is inactive."
      );
    }

    /*
     * Unit should match.
     */
    if (
      resource.unit.toLowerCase() !==
      item.unit.trim().toLowerCase()
    ) {
      throw AppError.badRequest(
        `Unit for resource "${resource.name}" must be "${resource.unit}".`
      );
    }

    if (
      item.quantityOffered >
      resource.totalQuantity
    ) {
      throw AppError.badRequest(
        `Offered quantity exceeds the total quantity of resource "${resource.name}".`
      );
    }
  }

  return ContributionOffer.create({
    initiative: initiative._id,

    partnerOrganization:
      partnerOrganizationId,

    submittedBy:
      authenticatedUser._id,

    items,

    organizationNotes:
      organizationNotes?.trim() || undefined,

    status:
      OFFER_STATUSES.SUBMITTED,
  });
};
export const reviewContributionOfferService = async ({
  offerId,
  decision,
  notes,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    offerId,
    "offerId"
  );

  if (
    ![
      OFFER_STATUSES.ACCEPTED,
      OFFER_STATUSES.REJECTED,
    ].includes(decision)
  ) {
    throw AppError.badRequest(
      "Decision must be accepted or rejected."
    );
  }

  const offer =
    await ContributionOffer.findById(
      offerId
    );

  if (!offer) {
    throw AppError.notFound(
      "Contribution offer not found."
    );
  }

  if (
    ![
      OFFER_STATUSES.SUBMITTED,
      OFFER_STATUSES.UNDER_REVIEW,
    ].includes(offer.status)
  ) {
    throw AppError.badRequest(
      "This contribution offer has already been processed."
    );
  }

  const initiative =
    await Initiative.findById(
      offer.initiative
    );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  /*
   * ONLY Lead Community Organization
   * OWNER/ADMIN may review.
   */
  if (
    authenticatedUser.accountType !==
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    throw AppError.forbidden(
      "Only the lead Community Organization can review contribution offers."
    );
  }

  const canReview =
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
    ) ?? false;

  if (!canReview) {
    throw AppError.forbidden(
      "You are not authorized to review contribution offers for this initiative."
    );
  }

  /*
   * REJECT
   */
  if (
    decision ===
    OFFER_STATUSES.REJECTED
  ) {
    offer.status =
      OFFER_STATUSES.REJECTED;

    offer.review = {
      reviewedBy:
        authenticatedUser._id,
      notes:
        notes?.trim() || null,
      reviewedAt:
        new Date(),
    };

    await offer.save();

    return {
      offer,
      reservations: [],
    };
  }

  /*
   * ACCEPT
   *
   * Validate every item again because quantities
   * may have changed since the offer was submitted.
   */
  const reservationPayloads = [];

  for (const item of offer.items) {
    const requirement =
      initiative.resourceRequirements.id(
        item.resourceRequirementId
      );

    if (!requirement) {
      throw AppError.badRequest(
        "A resource requirement referenced by this offer no longer exists."
      );
    }

    const remainingQuantity =
      requirement.quantityRequired -
      requirement.quantityReserved;

    if (
      item.quantityOffered >
      remainingQuantity
    ) {
      throw AppError.conflict(
        `Offer for "${requirement.name}" exceeds the remaining required quantity. Remaining quantity: ${remainingQuantity}.`
      );
    }

    const resource =
      await Resource.findById(
        item.resource
      );

    if (!resource || !resource.isActive) {
      throw AppError.badRequest(
        "One of the offered resources is no longer available."
      );
    }

    reservationPayloads.push({
      resource:
        item.resource,

      initiative:
        initiative._id,

      contributionOffer:
        offer._id,

      resourceRequirementId:
        requirement._id,

      quantity:
        item.quantityOffered,

      unit:
        item.unit,

      reservedFrom:
        item.availableFrom,

      reservedUntil:
        item.availableUntil,

      status: "active",

      /*
       * The Lead Community Org user who
       * accepted the offer.
       */
      reservedBy:
        authenticatedUser._id,
    });
  }

  /*
   * Create reservations.
   */
  const reservations =
    await ResourceReservation.insertMany(
      reservationPayloads
    );

  /*
   * Update embedded requirement quantities.
   */
  for (const item of offer.items) {
    const requirement =
      initiative.resourceRequirements.id(
        item.resourceRequirementId
      );

    requirement.quantityReserved +=
      item.quantityOffered;

    if (
      requirement.quantityReserved >=
      requirement.quantityRequired
    ) {
      requirement.status =
        "fully_reserved";

      requirement.quantityReserved =
        requirement.quantityRequired;
    } else if (
      requirement.quantityReserved > 0
    ) {
      requirement.status =
        "partially_met";
    }
  }

  offer.status =
    OFFER_STATUSES.ACCEPTED;

  offer.review = {
    reviewedBy:
      authenticatedUser._id,

    notes:
      notes?.trim() || null,

    reviewedAt:
      new Date(),
  };

  await initiative.save();
  await offer.save();

  return {
    offer,
    reservations,
  };
};
export const withdrawContributionOfferService = async ({
  offerId,
  reason,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    offerId,
    "offerId"
  );

  const offer =
    await ContributionOffer.findById(
      offerId
    );

  if (!offer) {
    throw AppError.notFound(
      "Contribution offer not found."
    );
  }

  if (
    ![
      OFFER_STATUSES.SUBMITTED,
      OFFER_STATUSES.UNDER_REVIEW,
    ].includes(offer.status)
  ) {
    throw AppError.badRequest(
      "This offer can no longer be withdrawn."
    );
  }

  const isSubmittingUser =
    offer.submittedBy.toString() ===
    authenticatedUser._id.toString();

  if (!isSubmittingUser) {
    throw AppError.forbidden(
      "You are not authorized to withdraw this offer."
    );
  }

  offer.status =
    OFFER_STATUSES.WITHDRAWN;

  offer.withdrawnAt =
    new Date();

  offer.withdrawalReason =
    reason?.trim() || null;

  await offer.save();

  return offer;
};