import mongoose from "mongoose";

import { Initiative } from "../models/initiative.model.js";
import Organization from "../models/organizationModel.js";
import { Resource } from "../models/resource.model.js";
import {
  USER_ROLES,ACCOUNT_STATUSES,
  ORGANIZATION_TYPES,
  DEPENDENCY_TYPES,
  ORGANIZATION_STATUSES,
  VERIFICATION_STATUSES,
  INITIATIVE_STATUSES,
  USER_ROLES_IN_ORGANIZATION,
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";

import {
  getActiveMemberships,
  getActiveMembershipByOrganizationId,
} from "../utils/organization-membership.js";


const ensureValidObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw AppError.badRequest(
      `${fieldName} must be a valid MongoDB ObjectId.`
    );
  }
};


const getOrganization = async (
  organizationId,
  expectedType
) => {
  ensureValidObjectId(
    organizationId,
    "organizationId"
  );

  const organization = await Organization.findOne({
    _id: organizationId,
    organizationType: expectedType,
    status: ORGANIZATION_STATUSES.ACTIVE,
  });

  if (!organization) {
    throw AppError.notFound(
      `${expectedType} organization was not found or is inactive.`
    );
  }

  return organization;
};


export const createInitiativeService = async ({
  payload,
  authenticatedUser,
}) => {
  const {
    title,
    description,
    municipality: requestedMunicipality,
    location,
    leadOrganization: requestedLeadOrganization,
    expectedOutcome,
    executionPeriod,
    tags = [],
  } = payload;

  /*
   * Basic required fields.
   */
  if (!title?.trim()) {
    throw AppError.badRequest(
      "Initiative title is required."
    );
  }

  if (!description?.trim()) {
    throw AppError.badRequest(
      "Initiative description is required."
    );
  }

  if (!expectedOutcome?.trim()) {
    throw AppError.badRequest(
      "Expected outcome is required."
    );
  }
   if (!location) {
    throw AppError.badRequest(
      "Initiative location is required."
    );
  }

  if (
    !executionPeriod?.plannedStartAt ||
    !executionPeriod?.plannedEndAt
  ) {
    throw AppError.badRequest(
      "Planned start and end dates are required."
    );
  }

  const plannedStartAt = new Date(
    executionPeriod.plannedStartAt
  );

  const plannedEndAt = new Date(
    executionPeriod.plannedEndAt
  );

  if (
    Number.isNaN(plannedStartAt.getTime()) ||
    Number.isNaN(plannedEndAt.getTime())
  ) {
    throw AppError.badRequest(
      "Invalid execution period dates."
    );
  }

  if (plannedEndAt <= plannedStartAt) {
    throw AppError.badRequest(
      "Planned end date must be after planned start date."
    );
  }

  let municipalityId;
  let leadOrganizationId;

  /*
   * MUNICIPALITY CREATOR
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    const activeMemberships =
      getActiveMemberships(authenticatedUser);

    if (activeMemberships.length === 0) {
      throw AppError.forbidden(
        "You are not linked to an active municipality membership."
      );
    }

    /*
     * For now, account type is one type and municipality
     * users should act through their municipality membership.
     *
     * If they have multiple memberships, require the municipality
     * explicitly so we don't guess.
     */
    if (activeMemberships.length === 1) {
      municipalityId =
        activeMemberships[0].organizationId;
    } else {
      if (!requestedMunicipality) {
        throw AppError.badRequest(
          "municipality is required because your account has multiple active memberships."
        );
      }

      ensureValidObjectId(
        requestedMunicipality,
        "municipality"
      );

      const membership =
        getActiveMembershipByOrganizationId(
          authenticatedUser,
          requestedMunicipality
        );

      if (!membership) {
        throw AppError.forbidden(
          "You cannot create an initiative for this municipality."
        );
      }

      municipalityId = requestedMunicipality;
    }

    if (!requestedLeadOrganization) {
      throw AppError.badRequest(
        "leadOrganization is required when a municipality creates an initiative."
      );
    }

    const leadOrganization =
      await getOrganization(
        requestedLeadOrganization,
        ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION
      );

    leadOrganizationId =
      leadOrganization._id;
  }

  /*
   * COMMUNITY ORGANIZATION CREATOR
   */
  else if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    if (!requestedMunicipality) {
      throw AppError.badRequest(
        "municipality is required."
      );
    }

    const municipality =
      await getOrganization(
        requestedMunicipality,
        ORGANIZATION_TYPES.MUNICIPALITY
      );

    municipalityId = municipality._id;

    /*
     * Find organizations where this user has an
     * OWNER or ADMIN membership.
     */
    const eligibleMemberships =
      getActiveMemberships(
        authenticatedUser
      ).filter((membership) =>
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role)
      );

    if (eligibleMemberships.length === 0) {
      throw AppError.forbidden(
        "You must be an owner or administrator of a Community Organization to create an initiative."
      );
    }

    /*
     * If the user belongs to only one eligible organization,
     * derive it automatically.
     */
    if (eligibleMemberships.length === 1) {
      leadOrganizationId =
        eligibleMemberships[0].organizationId;
    } else {
      /*
       * Multiple organizations → frontend must specify which
       * organization is creating the initiative.
       */
      if (!requestedLeadOrganization) {
        throw AppError.badRequest(
          "leadOrganization is required because you manage multiple organizations."
        );
      }

      ensureValidObjectId(
        requestedLeadOrganization,
        "leadOrganization"
      );

      const membership =
        eligibleMemberships.find(
          (item) =>
            item.organizationId.toString() ===
            requestedLeadOrganization.toString()
        );

      if (!membership) {
        throw AppError.forbidden(
          "You cannot create an initiative for this Community Organization."
        );
      }

      leadOrganizationId =
        requestedLeadOrganization;
    }

    /*
     * Verify derived organization really is a Community Org.
     */
    await getOrganization(
      leadOrganizationId,
      ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION
    );
  }

  /*
   * Everyone else is forbidden.
   */
  else {
    throw AppError.forbidden(
      "Only Municipalities and Community Organizations can create initiatives."
    );
  }

  /*
   * Verify municipality really is a Municipality.
   *
   * Important for municipality users because their membership
   * ObjectId alone doesn't guarantee organization type.
   */
  await getOrganization(
    municipalityId,
    ORGANIZATION_TYPES.MUNICIPALITY
  );

  const initiative = await Initiative.create({
    title: title.trim(),

    description: description.trim(),

    municipality: municipalityId,
    location:location,

    createdBy: authenticatedUser._id,

    leadOrganization:
      leadOrganizationId,

    expectedOutcome:
      expectedOutcome.trim(),

    executionPeriod: {
      plannedStartAt,
      plannedEndAt,
    },

    tags: Array.isArray(tags)
      ? tags
      : [],

    /*
     * Direct creation — not converted from Issue.
     */
    sourceIssue: null,

    /*
     * New initiatives always start as drafts.
     * Never accept this from req.body.
     */
    status:
      INITIATIVE_STATUSES.DRAFT,
  });

  return initiative;
};

export const getInitiativeByIdService = async ({
  initiativeId,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative = await Initiative.findById(
    initiativeId
  )
    .populate(
      "createdBy",
      "firstName lastName email accountType"
    )
    .populate(
      "municipality",
      "name organizationType status verificationStatus"
    )
    .populate(
      "leadOrganization",
      "name organizationType status verificationStatus"
    )
    .populate(
      "tasks.assignedOrganization",
      "name organizationType"
    )
    .populate(
      "tasks.completedBy",
      "firstName lastName email"
    )
    .populate(
      "availableResources.resource",
      "name category resourceType unit status"
    );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  /*
   * Municipality user:
   * must have an active membership in the
   * initiative's municipality.
   */
  let hasMunicipalityAccess = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    const municipalityId =
      initiative.municipality?._id ??
      initiative.municipality;

    hasMunicipalityAccess =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          membership.organizationId.toString() ===
            municipalityId.toString()
      ) ?? false;
  }

  /*
   * Community Organization user:
   * must belong to the initiative's lead organization.
   *
   * For read access, MEMBER/ADMIN/OWNER can all view it.
   */
  let hasLeadOrganizationAccess = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    const leadOrganizationId =
      initiative.leadOrganization?._id ??
      initiative.leadOrganization;

    hasLeadOrganizationAccess =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          membership.organizationId.toString() ===
            leadOrganizationId.toString()
      ) ?? false;
  }

  /*
   * Creator also gets access.
   */
  const creatorId =
    initiative.createdBy?._id ??
    initiative.createdBy;

  const isCreator =
    creatorId.toString() ===
    authenticatedUser._id.toString();

  if (
    !isCreator &&
    !hasMunicipalityAccess &&
    !hasLeadOrganizationAccess
  ) {
    throw AppError.forbidden(
      "You are not authorized to view this initiative."
    );
  }

  return initiative;
};
export const updateInitiativeService = async ({
  initiativeId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  /*
   * ---------------------------------------------
   * Authorization
   * ---------------------------------------------
   */

  let canEdit = false;

  /*
   * Municipality users may edit initiatives
   * belonging to their municipality.
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canEdit =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  /*
   * Community Organization users may edit
   * initiatives where their organization is
   * the lead organization.
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canEdit =
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
  }

  if (!canEdit) {
    throw AppError.forbidden(
      "You are not authorized to edit this initiative."
    );
  }

  /*
   * ---------------------------------------------
   * Allowed update fields
   * ---------------------------------------------
   */

  const allowedFields = [
    "title",
    "description",
    "location",
    "expectedOutcome",
    "executionPeriod",
    "tags",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest(
      "No valid initiative fields were provided."
    );
  }

  /*
   * ---------------------------------------------
   * Execution period validation
   * ---------------------------------------------
   */

  if (updates.executionPeriod) {
    const currentPeriod =
      initiative.executionPeriod;

    const plannedStartAt =
      updates.executionPeriod.plannedStartAt
        ? new Date(
            updates.executionPeriod.plannedStartAt
          )
        : currentPeriod.plannedStartAt;

    const plannedEndAt =
      updates.executionPeriod.plannedEndAt
        ? new Date(
            updates.executionPeriod.plannedEndAt
          )
        : currentPeriod.plannedEndAt;

    if (
      Number.isNaN(plannedStartAt.getTime()) ||
      Number.isNaN(plannedEndAt.getTime())
    ) {
      throw AppError.badRequest(
        "Invalid execution period dates."
      );
    }

    if (plannedEndAt <= plannedStartAt) {
      throw AppError.badRequest(
        "Planned end date must be after planned start date."
      );
    }

    /*
     * Preserve actual dates if they already exist.
     */
    updates.executionPeriod = {
      plannedStartAt,
      plannedEndAt,
      actualStartAt:
        currentPeriod.actualStartAt,
      actualEndAt:
        currentPeriod.actualEndAt,
    };
  }

  Object.assign(
    initiative,
    updates
  );

  await initiative.save();

  return initiative;
};
export const deleteInitiativeService = async ({
  initiativeId,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  let canDelete = false;

  /*
   * Municipality access
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canDelete =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  /*
   * Lead Community Organization access
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canDelete =
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
  }

  if (!canDelete) {
    throw AppError.forbidden(
      "You are not authorized to delete this initiative."
    );
  }

  const deletableStatuses = [
    INITIATIVE_STATUSES.DRAFT,
    INITIATIVE_STATUSES.CHANGES_REQUESTED,
    INITIATIVE_STATUSES.REJECTED,
  ];

  if (
    !deletableStatuses.includes(
      initiative.status
    )
  ) {
    throw AppError.conflict(
      "This initiative can no longer be deleted."
    );
  }

  /*
   * Later, before deleting, we'll also check:
   * - ResourceReservations
   * - ContributionOffers
   * - VolunteerApplications
   *
   * For now, keep deletion simple.
   */

  await initiative.deleteOne();

  return {
    deletedInitiativeId:
      initiative._id,
  };
};
export const submitInitiativeService = async ({
  initiativeId,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  /*
   * Only a draft initiative can be submitted.
   */
  if (
    initiative.status !==
    INITIATIVE_STATUSES.DRAFT
  ) {
    throw AppError.badRequest(
      "Only draft initiatives can be submitted."
    );
  }

  /*
   * -----------------------------------------
   * Authorization
   * -----------------------------------------
   */

  let canSubmit = false;

  /*
   * Municipality owner/admin
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canSubmit =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  /*
   * Lead Community Organization owner/admin
   */
  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canSubmit =
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
  }

  if (!canSubmit) {
    throw AppError.forbidden(
      "You are not authorized to submit this initiative."
    );
  }

  /*
   * -----------------------------------------
   * Validate required submission data
   * -----------------------------------------
   */

  if (
    !initiative.title ||
    !initiative.description ||
    !initiative.location ||
    !initiative.municipality ||
    !initiative.leadOrganization ||
    !initiative.expectedOutcome ||
    !initiative.executionPeriod?.plannedStartAt ||
    !initiative.executionPeriod?.plannedEndAt
  ) {
    throw AppError.badRequest(
      "The initiative is incomplete and cannot be submitted."
    );
  }

  /*
   * -----------------------------------------
   * Submit
   * -----------------------------------------
   */

  initiative.status =
    INITIATIVE_STATUSES.SUBMITTED;

  initiative.submittedAt = new Date();

  await initiative.save();

  return initiative;
};
export const addPhaseService = async ({
  initiativeId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound(
      "Initiative not found."
    );
  }

  let canManage = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canManage =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canManage =
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
  }

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage phases for this initiative."
    );
  }

  const {
    name,
    description,
    order,
    scheduledStartAt,
    scheduledEndAt,
  } = payload;

  if (!name?.trim()) {
    throw AppError.badRequest(
      "Phase name is required."
    );
  }

  if (!order || order < 1) {
    throw AppError.badRequest(
      "Phase order must be at least 1."
    );
  }

  if (
    scheduledStartAt &&
    scheduledEndAt &&
    new Date(scheduledEndAt) <=
      new Date(scheduledStartAt)
  ) {
    throw AppError.badRequest(
      "Phase end date must be after start date."
    );
  }

  const duplicateOrder =
    initiative.phases.some(
      (phase) => phase.order === order
    );

  if (duplicateOrder) {
    throw AppError.badRequest(
      "Another phase already uses this order."
    );
  }

  initiative.phases.push({
    name: name.trim(),

    description:
      description?.trim() || undefined,

    order,

    scheduledStartAt:
      scheduledStartAt
        ? new Date(scheduledStartAt)
        : undefined,

    scheduledEndAt:
      scheduledEndAt
        ? new Date(scheduledEndAt)
        : undefined,

    status: "pending",
  });

  await initiative.save();

  const createdPhase =
    initiative.phases[
      initiative.phases.length - 1
    ];

  return createdPhase;
};
export const updatePhaseService = async ({
  initiativeId,
  phaseId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(phaseId, "phaseId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  let canManage = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canManage =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canManage =
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
  }

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage phases for this initiative."
    );
  }

  const phase = initiative.phases.id(phaseId);

  if (!phase) {
    throw AppError.notFound("Phase not found.");
  }

  const allowedFields = [
    "name",
    "description",
    "order",
    "scheduledStartAt",
    "scheduledEndAt",
    "status",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest(
      "No valid phase fields were provided."
    );
  }

  if (
    updates.name !== undefined &&
    !updates.name?.trim()
  ) {
    throw AppError.badRequest(
      "Phase name cannot be empty."
    );
  }

  if (
    updates.order !== undefined &&
    updates.order < 1
  ) {
    throw AppError.badRequest(
      "Phase order must be at least 1."
    );
  }

  if (updates.order !== undefined) {
    const duplicateOrder =
      initiative.phases.some(
        (existingPhase) =>
          existingPhase._id.toString() !==
            phaseId.toString() &&
          existingPhase.order === updates.order
      );

    if (duplicateOrder) {
      throw AppError.badRequest(
        "Another phase already uses this order."
      );
    }
  }

  const scheduledStartAt =
    updates.scheduledStartAt !== undefined
      ? updates.scheduledStartAt
        ? new Date(updates.scheduledStartAt)
        : null
      : phase.scheduledStartAt;

  const scheduledEndAt =
    updates.scheduledEndAt !== undefined
      ? updates.scheduledEndAt
        ? new Date(updates.scheduledEndAt)
        : null
      : phase.scheduledEndAt;

  if (
    scheduledStartAt &&
    scheduledEndAt &&
    scheduledEndAt <= scheduledStartAt
  ) {
    throw AppError.badRequest(
      "Phase end date must be after start date."
    );
  }

  if (updates.name !== undefined) {
    phase.name = updates.name.trim();
  }

  if (updates.description !== undefined) {
    phase.description =
      updates.description?.trim() || "";
  }

  if (updates.order !== undefined) {
    phase.order = updates.order;
  }

  if (updates.scheduledStartAt !== undefined) {
    phase.scheduledStartAt = scheduledStartAt;
  }

  if (updates.scheduledEndAt !== undefined) {
    phase.scheduledEndAt = scheduledEndAt;
  }

  if (updates.status !== undefined) {
    phase.status = updates.status;
  }

  await initiative.save();

  return phase;
};

export const deletePhaseService = async ({
  initiativeId,
  phaseId,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(phaseId, "phaseId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  let canManage = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    canManage =
      authenticatedUser.memberships?.some(
        (membership) =>
          membership.status ===
            ACCOUNT_STATUSES.ACTIVE &&
          [
            USER_ROLES_IN_ORGANIZATION.OWNER,
            USER_ROLES_IN_ORGANIZATION.ADMIN,
          ].includes(membership.role) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  if (
    authenticatedUser.accountType ===
    USER_ROLES.COMMUNITY_ORGANIZATION
  ) {
    canManage =
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
  }

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage phases for this initiative."
    );
  }

  const phase = initiative.phases.id(phaseId);

  if (!phase) {
    throw AppError.notFound("Phase not found.");
  }

  /*
   * Do not delete a phase while tasks still reference it.
   */
  const phaseHasTasks = initiative.tasks.some(
    (task) =>
      task.phaseId?.toString() ===
      phaseId.toString()
  );

  if (phaseHasTasks) {
    throw AppError.conflict(
      "This phase cannot be deleted because one or more tasks belong to it."
    );
  }

  phase.deleteOne();

  await initiative.save();

  return {
    deletedPhaseId: phaseId,
  };
};
export const addTaskService = async ({
  initiativeId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage tasks for this initiative."
    );
  }

  const {
    title,
    description,
    phaseId,
    order,
    dependencies = [],
    assignedOrganization = null,
    requiredSkills = [],
    volunteerSlots = 0,
    scheduledStartAt = null,
    scheduledEndAt = null,
  } = payload;

  if (!title?.trim()) {
    throw AppError.badRequest(
      "Task title is required."
    );
  }

  if (!description?.trim()) {
    throw AppError.badRequest(
      "Task description is required."
    );
  }

  if (!phaseId) {
    throw AppError.badRequest(
      "phaseId is required."
    );
  }

  ensureValidObjectId(phaseId, "phaseId");

  const phase = initiative.phases.id(phaseId);

  if (!phase) {
    throw AppError.badRequest(
      "The selected phase does not exist in this initiative."
    );
  }

  if (!order || order < 1) {
    throw AppError.badRequest(
      "Task order must be at least 1."
    );
  }

  const duplicateOrder = initiative.tasks.some(
    (task) =>
      task.phaseId.toString() ===
        phaseId.toString() &&
      task.order === order
  );

  if (duplicateOrder) {
    throw AppError.badRequest(
      "Another task in this phase already uses this order."
    );
  }

  if (
    scheduledStartAt &&
    scheduledEndAt &&
    new Date(scheduledEndAt) <=
      new Date(scheduledStartAt)
  ) {
    throw AppError.badRequest(
      "Task end date must be after start date."
    );
  }

  if (assignedOrganization) {
    ensureValidObjectId(
      assignedOrganization,
      "assignedOrganization"
    );
  }

  initiative.tasks.push({
    title: title.trim(),
    description: description.trim(),
    phaseId,
    order,
    dependencies,
    assignedOrganization,
    requiredSkills,
    volunteerSlots,
    scheduledStartAt,
    scheduledEndAt,
  });

  await initiative.save();

  return initiative.tasks[
    initiative.tasks.length - 1
  ];
};
export const getTaskByIdService = async ({
  initiativeId,
  taskId,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(taskId, "taskId");

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const task = initiative.tasks.id(taskId);

  if (!task) {
    throw AppError.notFound("Task not found.");
  }

  return task;
};
export const updateTaskService = async ({
  initiativeId,
  taskId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(taskId, "taskId");

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage tasks for this initiative."
    );
  }

  const task = initiative.tasks.id(taskId);

  if (!task) {
    throw AppError.notFound("Task not found.");
  }

  const allowedFields = [
    "title",
    "description",
    "phaseId",
    "order",
    "dependencies",
    "assignedOrganization",
    "requiredSkills",
    "volunteerSlots",
    "scheduledStartAt",
    "scheduledEndAt",
    "status",
    "progress",
    "isLocked",
    "lockReasons",
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      task[field] = payload[field];
    }
  }

  if (
    payload.phaseId !== undefined
  ) {
    ensureValidObjectId(
      payload.phaseId,
      "phaseId"
    );

    const phase = initiative.phases.id(
      payload.phaseId
    );

    if (!phase) {
      throw AppError.badRequest(
        "The selected phase does not exist."
      );
    }
  }

  if (
    payload.order !== undefined
  ) {
    const targetPhaseId =
      payload.phaseId ?? task.phaseId;

    const duplicateOrder =
      initiative.tasks.some(
        (otherTask) =>
          otherTask._id.toString() !==
            taskId.toString() &&
          otherTask.phaseId.toString() ===
            targetPhaseId.toString() &&
          otherTask.order === payload.order
      );

    if (duplicateOrder) {
      throw AppError.badRequest(
        "Another task in this phase already uses this order."
      );
    }
  }

  await initiative.save();

  return task;
};
export const deleteTaskService = async ({
  initiativeId,
  taskId,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(taskId, "taskId");

  const initiative = await Initiative.findById(
    initiativeId
  );

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage tasks for this initiative."
    );
  }

  const task = initiative.tasks.id(taskId);

  if (!task) {
    throw AppError.notFound("Task not found.");
  }

  const isDependencyOfAnotherTask =
    initiative.tasks.some((otherTask) =>
      otherTask.dependencies?.some(
        (dependency) =>
          dependency.type ===
            DEPENDENCY_TYPES.TASK &&
          dependency.taskId?.toString() ===
            taskId.toString()
      )
    );

  if (isDependencyOfAnotherTask) {
    throw AppError.conflict(
      "This task cannot be deleted because another task depends on it."
    );
  }

  task.deleteOne();

  await initiative.save();

  return {
    deletedTaskId: taskId,
  };
};
export const addResourceRequirementService = async ({
  initiativeId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage resource requirements for this initiative."
    );
  }

  const {
    category,
    name,
    description,
    quantityRequired,
    unit,
    estimatedCost = null,
    requiredFrom = null,
    requiredUntil = null,
    serviceArea = null,
  } = payload;

  if (!category?.trim()) {
    throw AppError.badRequest(
      "Resource requirement category is required."
    );
  }

  if (!name?.trim()) {
    throw AppError.badRequest(
      "Resource requirement name is required."
    );
  }

  if (
    quantityRequired === undefined ||
    Number(quantityRequired) <= 0
  ) {
    throw AppError.badRequest(
      "quantityRequired must be greater than 0."
    );
  }

  if (!unit?.trim()) {
    throw AppError.badRequest(
      "Resource requirement unit is required."
    );
  }

  if (
    requiredFrom &&
    requiredUntil &&
    new Date(requiredUntil) <= new Date(requiredFrom)
  ) {
    throw AppError.badRequest(
      "requiredUntil must be after requiredFrom."
    );
  }

  initiative.resourceRequirements.push({
    category: category.trim(),
    name: name.trim(),
    description: description?.trim() || undefined,
    quantityRequired,
    quantityReserved: 0,
    unit: unit.trim(),
    estimatedCost,
    requiredFrom:
      requiredFrom ? new Date(requiredFrom) : undefined,
    requiredUntil:
      requiredUntil ? new Date(requiredUntil) : undefined,
    serviceArea:
      serviceArea?.trim() || undefined,
    status: "unmet",
    isVerifiedRequest: false,
  });

  await initiative.save();

  return initiative.resourceRequirements[
    initiative.resourceRequirements.length - 1
  ];
};
export const getResourceRequirementByIdService = async ({
  initiativeId,
  requirementId,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(requirementId, "requirementId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const requirement =
    initiative.resourceRequirements.id(requirementId);

  if (!requirement) {
    throw AppError.notFound(
      "Resource requirement not found."
    );
  }

  return requirement;
};
export const updateResourceRequirementService = async ({
  initiativeId,
  requirementId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(requirementId, "requirementId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage resource requirements for this initiative."
    );
  }

  const requirement =
    initiative.resourceRequirements.id(requirementId);

  if (!requirement) {
    throw AppError.notFound(
      "Resource requirement not found."
    );
  }

  const allowedFields = [
    "category",
    "name",
    "description",
    "quantityRequired",
    "unit",
    "estimatedCost",
    "requiredFrom",
    "requiredUntil",
    "serviceArea",
    "status",
    "isVerifiedRequest",
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      requirement[field] = payload[field];
    }
  }

  if (
    payload.quantityRequired !== undefined &&
    Number(payload.quantityRequired) <= 0
  ) {
    throw AppError.badRequest(
      "quantityRequired must be greater than 0."
    );
  }

  const requiredFrom =
    payload.requiredFrom !== undefined
      ? payload.requiredFrom
        ? new Date(payload.requiredFrom)
        : null
      : requirement.requiredFrom;

  const requiredUntil =
    payload.requiredUntil !== undefined
      ? payload.requiredUntil
        ? new Date(payload.requiredUntil)
        : null
      : requirement.requiredUntil;

  if (
    requiredFrom &&
    requiredUntil &&
    requiredUntil <= requiredFrom
  ) {
    throw AppError.badRequest(
      "requiredUntil must be after requiredFrom."
    );
  }

  requirement.requiredFrom = requiredFrom;
  requirement.requiredUntil = requiredUntil;

  await initiative.save();

  return requirement;
};
export const deleteResourceRequirementService = async ({
  initiativeId,
  requirementId,
  authenticatedUser,
}) => {
  ensureValidObjectId(initiativeId, "initiativeId");
  ensureValidObjectId(requirementId, "requirementId");

  const initiative = await Initiative.findById(initiativeId);

  if (!initiative) {
    throw AppError.notFound("Initiative not found.");
  }

  const canManage =
    authenticatedUser.memberships?.some(
      (membership) =>
        membership.status === ACCOUNT_STATUSES.ACTIVE &&
        [
          USER_ROLES_IN_ORGANIZATION.OWNER,
          USER_ROLES_IN_ORGANIZATION.ADMIN,
        ].includes(membership.role) &&
        [
          initiative.municipality.toString(),
          initiative.leadOrganization.toString(),
        ].includes(
          membership.organizationId.toString()
        )
    ) ?? false;

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage resource requirements for this initiative."
    );
  }

  const requirement =
    initiative.resourceRequirements.id(requirementId);

  if (!requirement) {
    throw AppError.notFound(
      "Resource requirement not found."
    );
  }

  const taskDependsOnRequirement =
    initiative.tasks.some((task) =>
      task.dependencies?.some(
        (dependency) =>
          dependency.type ===
            DEPENDENCY_TYPES.RESOURCE &&
          dependency.resourceRequirementId?.toString() ===
            requirementId.toString()
      )
    );

  if (taskDependsOnRequirement) {
    throw AppError.conflict(
      "This resource requirement cannot be deleted because one or more tasks depend on it."
    );
  }

  if (requirement.quantityReserved > 0) {
    throw AppError.conflict(
      "This resource requirement cannot be deleted because resources have already been reserved for it."
    );
  }

  requirement.deleteOne();

  await initiative.save();

  return {
    deletedRequirementId: requirementId,
  };
};