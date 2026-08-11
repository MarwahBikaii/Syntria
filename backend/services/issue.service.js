import mongoose, { isValidObjectId } from "mongoose";

import { Issue } from "../models/issue.model.js";
import Organization from "../models/organizationModel.js";
import { Initiative } from "../models/initiative.model.js";
import {
  ISSUE_STATUSES,
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,USER_ROLES,MUNICIPALITY_REVIEW_DECISIONS
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";

import {
  uploadFilesToCloudinary,
  deleteCloudinaryAssets,
} from "./cloudinary.service.js";


/*
 * ---------------------------------------------------------
 * Helper: validate MongoDB ObjectId
 * ---------------------------------------------------------
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
 * ---------------------------------------------------------
 * Helper: verify municipality
 * ---------------------------------------------------------
 *
 * The municipality sent by the user must:
 *
 * 1. Exist
 * 2. Be an Organization
 * 3. Have organizationType = municipality
 * 4. Be active
 */

const verifyMunicipality = async (
  municipalityId
) => {
  ensureValidObjectId(
    municipalityId,
    "municipality"
  );

  const municipality =
    await Organization.findOne({
      _id: municipalityId,

      organizationType:
        ORGANIZATION_TYPES.MUNICIPALITY,

      status:
        ORGANIZATION_STATUSES.ACTIVE,
    }).select(
      "_id name organizationType status"
    );

  if (!municipality) {
    throw AppError.notFound(
      "An active municipality with this ID was not found."
    );
  }

  return municipality;
};


/*
 * ---------------------------------------------------------
 * CREATE ISSUE
 * POST /api/issues
 * ---------------------------------------------------------
 *
 * Creates the report as PENDING.
 *
 * At this stage:
 *
 * - AI is NOT executed
 * - Duplicate detection is NOT executed
 * - Media is optional
 * - submittedAt remains null
 *
 * The authenticated user becomes createdBy.
 */

export const createIssueService = async ({
  payload,
  files = [],
  authenticatedUser,
}) => {
  /*
   * Defensive validation.
   */
  if (!payload) {
    throw AppError.badRequest(
      "Issue data is required."
    );
  }

  if (!authenticatedUser?._id) {
    throw AppError.unauthorized(
      "Authentication is required."
    );
  }

  const {
    title,
    description,
    location,
    municipality,
    tags = [],
  } = payload;

  /*
   * Required report information.
   */
  if (!title?.trim()) {
    throw AppError.badRequest(
      "Title is required."
    );
  }

  if (!description?.trim()) {
    throw AppError.badRequest(
      "Description is required."
    );
  }

  if (!location) {
    throw AppError.badRequest(
      "Location is required."
    );
  }

  if (!municipality) {
    throw AppError.badRequest(
      "Municipality is required."
    );
  }

  /*
   * Make sure municipality really exists
   * and is an active Municipality organization.
   */
  await verifyMunicipality(municipality);

  let uploadedMedia = [];

  try {
    /*
     * Media is optional while the report is PENDING.
     *
     * If files were provided, upload them to Cloudinary.
     */
    if (
      Array.isArray(files) &&
      files.length > 0
    ) {
      uploadedMedia =
        await uploadFilesToCloudinary(
          files,
          authenticatedUser._id
        );
    }

    /*
     * Create the Issue.
     *
     * createdBy comes ONLY from authenticatedUser.
     * Never accept createdBy from req.body.
     */
    const issue = await Issue.create({
      title: title.trim(),

      description: description.trim(),

      location,

      municipality,

      createdBy:
        authenticatedUser._id,

      media: uploadedMedia,

      tags:
        Array.isArray(tags)
          ? tags
          : [],

      status:
        ISSUE_STATUSES.PENDING,

      submittedAt: null,

      duplicateDecision:
        "not_checked",

      duplicateCandidates: [],

      supports: [],
    });

    return issue;
  } catch (error) {
    /*
     * MongoDB failed after Cloudinary upload:
     * remove uploaded assets so we don't leave
     * orphaned files.
     */
    if (uploadedMedia.length > 0) {
      await deleteCloudinaryAssets(
        uploadedMedia
      );
      
    }

    throw error;
  }
};

export const submitIssueService = async ({
  issueId,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const issue = await Issue.findOne({
    _id: issueId,
    createdBy: authenticatedUser._id,
  });

  if (!issue) {
    throw AppError.notFound(
      "Issue not found or you are not authorized to submit it."
    );
  }

  if (issue.status !== ISSUE_STATUSES.PENDING) {
    throw AppError.conflict(
      "Only pending issues can be submitted."
    );
  }

  issue.status = ISSUE_STATUSES.SUBMITTED;
  issue.submittedAt = new Date();

  await issue.save();

  return issue;
};




export const updateIssueService = async ({
  issueId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const allowedFields = [
    "title",
    "description",
    "location",
    "municipality",
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
      "No valid issue fields were provided."
    );
  }

  /*
   * If municipality is being changed,
   * verify that it really is an active municipality.
   */
  if (updates.municipality) {
    await verifyMunicipality(
      updates.municipality
    );
  }

  const issue = await Issue.findOne({
    _id: issueId,
    createdBy: authenticatedUser._id,
    status: ISSUE_STATUSES.PENDING,
  });

  if (!issue) {
    throw AppError.notFound(
      "Pending issue not found or you are not authorized to modify it."
    );
  }

  /*
   * Update only whitelisted fields.
   */
  for (const [field, value] of Object.entries(
    updates
  )) {
    issue[field] = value;
  }

  await issue.save();

  return issue;
};
export const deleteIssueService = async ({
  issueId,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const issue = await Issue.findOne({
    _id: issueId,
    createdBy: authenticatedUser._id,
  });

  if (!issue) {
    throw AppError.notFound("Issue not found.");
  }

  if (issue.status !== ISSUE_STATUSES.PENDING) {
    throw ApfError.conflict(
      "Only pending issues can be deleted."
    );
  }

  await issue.deleteOne();

  return;
};

export const supportExistingIssueService = async ({
  issueId,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const issue = await Issue.findById(issueId);

  if (!issue) {
    throw AppError.notFound(
      "Issue not found."
    );
  }

  /*
   * Creator should not support their own issue.
   */
  if (
    issue.createdBy.toString() ===
    authenticatedUser._id.toString()
  ) {
    throw AppError.badRequest(
      "You cannot support your own issue."
    );
  }

  /*
   * Only submitted / under-review issues
   * can receive support.
   */
  const allowedStatuses = [
    ISSUE_STATUSES.SUBMITTED,
    ISSUE_STATUSES.UNDER_REVIEW,
  ];

  if (!allowedStatuses.includes(issue.status)) {
    throw AppError.conflict(
      "This issue is not available for support."
    );
  }

  /*
   * $addToSet prevents the same user ID
   * from being inserted more than once.
   */
  const updatedIssue =
    await Issue.findByIdAndUpdate(
      issueId,
      {
        $addToSet: {
          supporting_users:
            authenticatedUser._id,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      "supporting_users",
      "firstName lastName accountType"
    );

  return updatedIssue;
};
export const removeSupportIssueService = async ({
  issueId,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const issue = await Issue.findById(issueId);

  if (!issue) {
    throw AppError.notFound(
      "Issue not found."
    );
  }

  if (
    issue.createdBy.toString() ===
    authenticatedUser._id.toString()
  ) {
    throw AppError.badRequest(
      "You cannot manage support on your own issue."
    );
  }

  const allowedStatuses = [
    ISSUE_STATUSES.SUBMITTED,
    ISSUE_STATUSES.UNDER_REVIEW,
  ];

  if (!allowedStatuses.includes(issue.status)) {
    throw AppError.conflict(
      "Support cannot be removed from this issue in its current status."
    );
  }

  //ids are object ids , convert to string
  //walk through the set supported_user , 
  const alreadySupports = issue.supporting_users.some(
    (userId) =>
      userId.toString() ===
      authenticatedUser._id.toString()
  );

  if (!alreadySupports) {
    throw AppError.badRequest(
      "You are not currently supporting this issue."
    );
  }

  const updatedIssue =
    await Issue.findByIdAndUpdate(
      issueId,
      {
        $pull: {
          supporting_users:
            authenticatedUser._id,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      "supporting_users",
      "firstName lastName accountType"
    );

  return updatedIssue;
};

export const getIssueByIdService = async ({
  issueId,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");


  const issue = await Issue.findById(issueId)
    .populate(
      "createdBy",
      "firstName lastName email accountType"
    )
    .populate(
      "municipality",
      "name organizationType status verificationStatus"
    )
    .populate(
      "supporting_users",
      "firstName lastName accountType"
    )
    .populate(
      "duplicateCandidates.issue",
      "title description status priority location createdAt"
    )
   

  if (!issue) {
    throw AppError.notFound("Issue not found.");
  }

  /*
   * Check if logged-in user created this issue.
   */
  const creatorId =
    issue.createdBy?._id ?? issue.createdBy;

  const isCreator =
    creatorId.toString() ===
    authenticatedUser._id.toString();

  /*
   * Municipality access.
   *
   * User must:
   * - have accountType municipality
   * - have an ACTIVE membership
   * - membership organization must match issue municipality
   */
  let isAssignedMunicipalityUser = false;

  if (
    authenticatedUser.accountType ===
    USER_ROLES.MUNICIPALITY
  ) {
    const municipalityId =
      issue.municipality?._id ??
      issue.municipality;

    isAssignedMunicipalityUser =
      authenticatedUser.memberships?.some(
        (membership) => {
          return (
            membership.status ===
              ACCOUNT_STATUSES.ACTIVE &&
            membership.organizationId.toString() ===
              municipalityId.toString()
          );
        }
      ) ?? false;
  }

  if (
    !isCreator &&
    !isAssignedMunicipalityUser
  ) {
    throw AppError.forbidden(
      "You are not authorized to view this issue."
    );
  }

  return issue;
};
export const reviewIssueService = async ({
  issueId,
  decision,
  notes,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const allowedDecisions = Object.values(
    MUNICIPALITY_REVIEW_DECISIONS
  );

  if (!allowedDecisions.includes(decision)) {
    throw AppError.badRequest(
      "Invalid municipality review decision."
    );
  }

  /*
   * Find all active organization memberships
   * for the logged-in municipality user.
   */
  const activeMunicipalityIds =
    authenticatedUser.memberships
      ?.filter(
        (membership) =>
          membership.status ===
          ACCOUNT_STATUSES.ACTIVE
      )
      .map((membership) =>
        membership.organizationId.toString()
      ) ?? [];

  if (activeMunicipalityIds.length === 0) {
    throw AppError.forbidden(
      "You are not linked to an active municipality."
    );
  }

  /*
   * Municipality can only review issues routed
   * to one of its organizations.
   */
  const issue = await Issue.findOne({
    _id: issueId,

    municipality: {
      $in: activeMunicipalityIds,
    },

    status: {
      $in: [
        ISSUE_STATUSES.SUBMITTED,
        ISSUE_STATUSES.UNDER_REVIEW,
      ],
    },
  });

  if (!issue) {
    throw AppError.notFound(
      "Issue not found or unavailable for review."
    );
  }

  /*
   * Converting an issue creates another document,
   * so keep that operation in its own endpoint.
   */
  if (
    decision ===
    MUNICIPALITY_REVIEW_DECISIONS.CONVERT_TO_INITIATIVE
  ) {
    throw AppError.badRequest(
      "Use the dedicated issue-to-initiative conversion endpoint."
    );
  }

  if (
    decision ===
    MUNICIPALITY_REVIEW_DECISIONS.RESOLVE_INTERNALLY
  ) {
    issue.status =
      ISSUE_STATUSES.RESOLVED_INTERNALLY;

    issue.resolvedInternallyAt =
      new Date();
  }

  if (
    decision ===
    MUNICIPALITY_REVIEW_DECISIONS.REJECT
  ) {
    issue.status =
      ISSUE_STATUSES.REJECTED;
  }

  issue.municipalityReview = {
    decision,
    reviewedBy: authenticatedUser._id,
    notes: notes?.trim() || null,
    reviewedAt: new Date(),
  };

  await issue.save();

  return issue;
};
export const convertIssueToInitiativeService = async ({
  issueId,
  payload,
  authenticatedUser,
}) => {
  ensureValidObjectId(issueId, "issueId");

  const {
    leadOrganization,
    expectedOutcome,
    executionPeriod,
    phases = [],
    tasks = [],
    resourceRequirements = [],
    reviewNotes,
  } = payload;

  if (!leadOrganization) {
    throw AppError.badRequest(
      "leadOrganization is required."
    );
  }

  if (!expectedOutcome?.trim()) {
    throw AppError.badRequest(
      "expectedOutcome is required."
    );
  }

  if (
    !executionPeriod?.plannedStartAt ||
    !executionPeriod?.plannedEndAt
  ) {
    throw AppError.badRequest(
      "plannedStartAt and plannedEndAt are required."
    );
  }

  ensureValidObjectId(
    leadOrganization,
    "leadOrganization"
  );

  /*
   * Get municipalities where this logged-in user
   * has an active membership.
   */
  const activeMunicipalityIds =
    authenticatedUser.memberships
      ?.filter(
        (membership) =>
          membership.status ===
          ACCOUNT_STATUSES.ACTIVE
      )
      .map((membership) =>
        membership.organizationId.toString()
      ) ?? [];

  if (activeMunicipalityIds.length === 0) {
    throw AppError.forbidden(
      "You are not linked to an active municipality."
    );
  }

  /*
   * Validate selected lead organization.
   */
  const leadOrganizationRecord =
    await Organization.findOne({
      _id: leadOrganization,

      organizationType:
        ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION,

      status:
        ORGANIZATION_STATUSES.ACTIVE,
    });

  if (!leadOrganizationRecord) {
    throw AppError.notFound(
      "The selected Community Organization was not found or is inactive."
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    /*
     * Issue must:
     *
     * - belong to user's municipality
     * - already be submitted/reviewable
     * - not already be converted
     */
    const issue = await Issue.findOne({
      _id: issueId,

      municipality: {
        $in: activeMunicipalityIds,
      },

      status: {
        $in: [
          ISSUE_STATUSES.SUBMITTED,
          ISSUE_STATUSES.UNDER_REVIEW,
        ],
      },

      convertedInitiative: null,
    }).session(session);

    if (!issue) {
      throw AppError.notFound(
        "Issue was not found, is unavailable for conversion, or has already been converted."
      );
    }

    /*
     * Create Initiative using common fields from Issue.
     */
    const [initiative] =
      await Initiative.create(
        [
          {
            title: issue.title,

            description:
              issue.description,

            location:
              issue.location,

            municipality:
              issue.municipality,

            createdBy:
              authenticatedUser._id,

            tags:
              issue.tags ?? [],

            /*
             * Optional for now.
             */
            media:
              issue.media ?? [],

            status:
              INITIATIVE_STATUSES.DRAFT,

            sourceIssue:
              issue._id,

            leadOrganization,

            expectedOutcome:
              expectedOutcome.trim(),

            executionPeriod,

            phases,

            tasks,

            resourceRequirements,

            approval: {
              decision: "approved",

              reviewedBy:
                authenticatedUser._id,

              notes:
                reviewNotes?.trim() ||
                "Initiative created from an approved community issue.",

              reviewedAt:
                new Date(),

              revisionNumber: 0,
            },

            readiness: {
              status:
                READINESS_STATUSES.BLOCKED,

              municipalityApproved: true,

              resourcesSatisfied: false,

              dependenciesSatisfied: false,

              blockingReasons: [
                "Resource and dependency readiness must be calculated.",
              ],

              calculatedAt:
                new Date(),
            },
          },
        ],
        {
          session,
        }
      );

    /*
     * Update original Issue.
     */
    issue.status =
      ISSUE_STATUSES.CONVERTED_TO_INITIATIVE;

    issue.convertedInitiative =
      initiative._id;

    issue.municipalityReview = {
      decision:
        MUNICIPALITY_REVIEW_DECISIONS
          .CONVERT_TO_INITIATIVE,

      reviewedBy:
        authenticatedUser._id,

      notes:
        reviewNotes?.trim() ||
        "Issue converted into an initiative.",

      reviewedAt:
        new Date(),
    };

    await issue.save({
      session,
    });

    await session.commitTransaction();

    return {
      issue,
      initiative,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
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
    INITIATIVE_STATUSES.SUBMITTED,
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