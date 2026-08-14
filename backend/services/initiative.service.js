import mongoose from "mongoose";

import { Initiative } from "../models/initiative.model.js";
import {
  ResourceRequirement,
} from "../models/resource-requirement.model.js";

import {
  ResourceRequest,
} from "../models/resource-request.model.js";

import {
  ResourceReservation,
} from "../models/resource-reservation.model.js";

import {
  ContributionOffer,
} from "../models/contribution-offer.model.js";
import Organization from "../models/organizationModel.js";
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
import { authenticate } from "../middleware/auth.middleware.js";


const ensureValidObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw AppError.badRequest(
      `${fieldName} must be a valid MongoDB ObjectId.`
    );
  }
};

//regex is a language describing string pattern to match
// .=> any character as such p.rk can be park pork...
// * means repeat previous 0 or more times
//so sanitizing user input is important

// \\ = > insert literal \
const escapeRegex = (value) => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"// $& insert whatever character that matched

  );
};

const validateTaskDependencies = async ({
  dependencies,
  initiative,
  currentTaskId = null,
}) => {
  if (!Array.isArray(dependencies)) {
    throw AppError.badRequest(
      "dependencies must be an array."
    );
  }

  const normalizedDependencies = [];

  const seenDependencies = new Set();

  const resourceRequirementIds = [];

  for (
    let index = 0;
    index < dependencies.length;
    index += 1
  ) {
    const dependency =
      dependencies[index];

    if (
      !dependency ||
      typeof dependency !== "object"
    ) {
      throw AppError.badRequest(
        `Dependency at index ${index} is invalid.`
      );
    }

    if (
      !Object.values(
        DEPENDENCY_TYPES
      ).includes(dependency.type)
    ) {
      throw AppError.badRequest(
        `Dependency at index ${index} has an invalid type.`
      );
    }

    /*
     * =============================================
     * TASK DEPENDENCY
     * =============================================
     */

    if (
      dependency.type ===
      DEPENDENCY_TYPES.TASK
    ) {
      if (!dependency.taskId) {
        throw AppError.badRequest(
          `taskId is required for task dependency at index ${index}.`
        );
      }

      ensureValidObjectId(
        dependency.taskId,
        `dependencies[${index}].taskId`
      );

      /*
       * Task cannot depend on itself.
       */
      if (
        currentTaskId &&
        dependency.taskId.toString() ===
          currentTaskId.toString()
      ) {
        throw AppError.badRequest(
          "A task cannot depend on itself."
        );
      }

      /*
       * Because tasks are embedded, the referenced
       * task must exist inside THIS Initiative.
       */
      const referencedTask =
        initiative.tasks.id(
          dependency.taskId
        );

      if (!referencedTask) {
        throw AppError.badRequest(
          `Task dependency ${dependency.taskId} does not exist in this initiative.`
        );
      }

      const dependencyKey =
        `task:${dependency.taskId.toString()}`;

      if (
        seenDependencies.has(
          dependencyKey
        )
      ) {
        throw AppError.badRequest(
          "Duplicate task dependency detected."
        );
      }

      seenDependencies.add(
        dependencyKey
      );

      normalizedDependencies.push({
        type:
          DEPENDENCY_TYPES.TASK,

        taskId:
          dependency.taskId,

        resourceRequirement:
          null,

        approvalType:
          null,

        description:
          dependency.description
            ?.trim() || null,
      });

      continue;
    }

    /*
     * =============================================
     * RESOURCE DEPENDENCY
     * =============================================
     */

    if (
      dependency.type ===
      DEPENDENCY_TYPES.RESOURCE
    ) {
      if (
        !dependency.resourceRequirement
      ) {
        throw AppError.badRequest(
          `resourceRequirement is required for resource dependency at index ${index}.`
        );
      }

      ensureValidObjectId(
        dependency.resourceRequirement,
        `dependencies[${index}].resourceRequirement`
      );

      const requirementId =
        dependency.resourceRequirement.toString();

      const dependencyKey =
        `resource:${requirementId}`;

      if (
        seenDependencies.has(
          dependencyKey
        )
      ) {
        throw AppError.badRequest(
          "Duplicate resource dependency detected."
        );
      }

      seenDependencies.add(
        dependencyKey
      );

      resourceRequirementIds.push(
        requirementId
      );

      normalizedDependencies.push({
        type:
          DEPENDENCY_TYPES.RESOURCE,

        taskId:
          null,

        resourceRequirement:
          dependency.resourceRequirement,

        approvalType:
          null,

        description:
          dependency.description
            ?.trim() || null,
      });

      continue;
    }

    /*
     * =============================================
     * APPROVAL DEPENDENCY
     * =============================================
     */

    if (
      dependency.type ===
      DEPENDENCY_TYPES.APPROVAL
    ) {
      if (
        !dependency.approvalType
          ?.trim()
      ) {
        throw AppError.badRequest(
          `approvalType is required for approval dependency at index ${index}.`
        );
      }

      const normalizedApprovalType =
        dependency.approvalType
          .trim()
          .toLowerCase();

      const dependencyKey =
        `approval:${normalizedApprovalType}`;

      if (
        seenDependencies.has(
          dependencyKey
        )
      ) {
        throw AppError.badRequest(
          "Duplicate approval dependency detected."
        );
      }

      seenDependencies.add(
        dependencyKey
      );

      normalizedDependencies.push({
        type:
          DEPENDENCY_TYPES.APPROVAL,

        taskId:
          null,

        resourceRequirement:
          null,

        approvalType:
          normalizedApprovalType,

        description:
          dependency.description
            ?.trim() || null,
      });
    }
  }

  /*
   * ---------------------------------------------------
   * Validate ResourceRequirements in ONE database query
   * ---------------------------------------------------
   *
   * Important:
   *
   * Requirement must:
   * 1. exist
   * 2. belong to THIS Initiative
   */

  if (
    resourceRequirementIds.length > 0
  ) {
    const uniqueIds = [
      ...new Set(
        resourceRequirementIds
      ),
    ];

    const matchingRequirements =
      await ResourceRequirement.countDocuments(
        {
          _id: {
            $in: uniqueIds,
          },

          initiative:
            initiative._id,
        }
      );

    if (
      matchingRequirements !==
      uniqueIds.length
    ) {
      throw AppError.badRequest(
        "One or more resource dependencies do not belong to this initiative."
      );
    }
  }

  return normalizedDependencies;
};
const ensureNoCircularTaskDependency = ({
  initiative,
  taskId,
  dependencies,
}) => {
  const targetTaskId =
    taskId.toString();

  /*
   * Build dependency graph:
   *
   * taskId -> [task dependencies]
   */
  const graph = new Map();

  for (const task of initiative.tasks) {
    const id =
      task._id.toString();

    const taskDependencies =
      id === targetTaskId
        ? dependencies
        : task.dependencies;

    const dependentTaskIds =
      taskDependencies
        ?.filter(
          (dependency) =>
            dependency.type ===
              DEPENDENCY_TYPES.TASK &&
            dependency.taskId
        )
        .map(
          (dependency) =>
            dependency.taskId.toString()
        ) ?? [];

    graph.set(
      id,
      dependentTaskIds
    );
  }

  /*
   * For a new task.
   */
  if (!graph.has(targetTaskId)) {
    graph.set(
      targetTaskId,

      dependencies
        .filter(
          (dependency) =>
            dependency.type ===
              DEPENDENCY_TYPES.TASK &&
            dependency.taskId
        )
        .map(
          (dependency) =>
            dependency.taskId.toString()
        )
    );
  }

  const visiting = new Set();
  const visited = new Set();

  const hasCycle = (id) => {
    if (visiting.has(id)) {
      return true;
    }

    if (visited.has(id)) {
      return false;
    }

    visiting.add(id);

    const neighbors =
      graph.get(id) ?? [];

    for (const neighbor of neighbors) {
      /*
       * Ignore IDs that aren't tasks in the graph.
       * They should already have been rejected by
       * validateTaskDependencies anyway.
       */
      if (
        graph.has(neighbor) &&
        hasCycle(neighbor)
      ) {
        return true;
      }
    }

    visiting.delete(id);
    visited.add(id);

    return false;
  };

  if (hasCycle(targetTaskId)) {
    throw AppError.conflict(
      "This dependency would create a circular task dependency."
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

  if (executionPeriod.actualStartAt)
    var actualStartAt= new Date(executionPeriod.actualStartAt)

  if (executionPeriod.actualEndAt)
    var actualEndAt= new Date(executionPeriod.actualEndAt)

  const plannedStartAt = new Date(
    executionPeriod.plannedStartAt
  );

  const plannedEndAt = new Date(
    executionPeriod.plannedEndAt
  );

  if (
    Number.isNaN(plannedStartAt.getTime()) ||
    Number.isNaN(plannedEndAt.getTime())||
    Number.isNaN(actualStartAt.getTime())
||
   Number.isNaN(actualEndAt.getTime())

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
      actualStartAt,
      actualEndAt
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
   * Allowed submission states
   * ---------------------------------------------------
   *
   * First submission:
   * DRAFT -> SUBMITTED
   *
   * Resubmission:
   * CHANGES_REQUESTED -> SUBMITTED
   */

  const allowedStatuses = [
    INITIATIVE_STATUSES.DRAFT,
    INITIATIVE_STATUSES.CHANGES_REQUESTED,
  ];

  if (
    !allowedStatuses.includes(
      initiative.status
    )
  ) {
    throw AppError.badRequest(
      "Only draft initiatives or initiatives with requested changes can be submitted."
    );
  }

  /*
   * ---------------------------------------------------
   * Authorization
   * ---------------------------------------------------
   */

  let canSubmit = false;

  /*
   * Municipality OWNER / ADMIN
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
          ].includes(
            membership.role
          ) &&
          membership.organizationId.toString() ===
            initiative.municipality.toString()
      ) ?? false;
  }

  /*
   * Lead Community Organization OWNER / ADMIN
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
          ].includes(
            membership.role
          ) &&
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
   * ---------------------------------------------------
   * Validate required Initiative information
   * ---------------------------------------------------
   */

  if (
    !initiative.title ||
    !initiative.description ||
    !initiative.location ||
    !initiative.municipality ||
    !initiative.leadOrganization ||
    !initiative.expectedOutcome ||
    !initiative.executionPeriod
      ?.plannedStartAt ||
    !initiative.executionPeriod
      ?.plannedEndAt
  ) {
    throw AppError.badRequest(
      "The initiative is incomplete and cannot be submitted."
    );
  }

  /*
   * ---------------------------------------------------
   * Submission
   * ---------------------------------------------------
   */

  initiative.status =
    INITIATIVE_STATUSES.SUBMITTED;

  initiative.submittedAt =
    new Date();

  /*
   * When resubmitting after requested changes,
   * the old municipality decision should no longer
   * represent the current review state.
   *
   * Keep revisionNumber because the next municipality
   * review will increment it.
   */
  initiative.approval.decision =
    "pending";

  initiative.approval.reviewedBy =
    null;

  initiative.approval.notes =
    null;

  initiative.approval.reviewedAt =
    null;

  /*
   * Approval/readiness must remain false until
   * the Municipality approves this submission.
   */
  initiative.readiness
    .municipalityApproved = false;

  initiative.readiness.calculatedAt =
    new Date();

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
   * ---------------------------------------------------
   * Authorization
   * ---------------------------------------------------
   */

  const canManage =
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

  /*
   * ---------------------------------------------------
   * Basic fields
   * ---------------------------------------------------
   */

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

  ensureValidObjectId(
    phaseId,
    "phaseId"
  );

  const phase =
    initiative.phases.id(
      phaseId
    );

  if (!phase) {
    throw AppError.badRequest(
      "The selected phase does not exist in this initiative."
    );
  }

  const normalizedOrder =
    Number(order);

  if (
    !Number.isInteger(
      normalizedOrder
    ) ||
    normalizedOrder < 1
  ) {
    throw AppError.badRequest(
      "Task order must be an integer of at least 1."
    );
  }

  const duplicateOrder =
    initiative.tasks.some(
      (task) =>
        task.phaseId.toString() ===
          phaseId.toString() &&
        task.order ===
          normalizedOrder
    );

  if (duplicateOrder) {
    throw AppError.badRequest(
      "Another task in this phase already uses this order."
    );
  }

  /*
   * ---------------------------------------------------
   * Dates
   * ---------------------------------------------------
   */

  const parsedStartAt =
    scheduledStartAt
      ? new Date(
          scheduledStartAt
        )
      : null;

  const parsedEndAt =
    scheduledEndAt
      ? new Date(
          scheduledEndAt
        )
      : null;

  if (
    parsedStartAt &&
    Number.isNaN(
      parsedStartAt.getTime()
    )
  ) {
    throw AppError.badRequest(
      "scheduledStartAt is invalid."
    );
  }

  if (
    parsedEndAt &&
    Number.isNaN(
      parsedEndAt.getTime()
    )
  ) {
    throw AppError.badRequest(
      "scheduledEndAt is invalid."
    );
  }

  if (
    parsedStartAt &&
    parsedEndAt &&
    parsedEndAt <= parsedStartAt
  ) {
    throw AppError.badRequest(
      "Task end date must be after start date."
    );
  }

  /*
   * ---------------------------------------------------
   * Assigned Organization
   * ---------------------------------------------------
   */

  if (assignedOrganization) {
    ensureValidObjectId(
      assignedOrganization,
      "assignedOrganization"
    );
  }

  /*
   * ---------------------------------------------------
   * Dependency validation
   * ---------------------------------------------------
   */

  const normalizedDependencies =
    await validateTaskDependencies({
      dependencies,
      initiative,
    });

  /*
   * Pre-generate embedded Task ID.
   */
  const taskId =
    new mongoose.Types.ObjectId();

  ensureNoCircularTaskDependency({
    initiative,
    taskId,
    dependencies:
      normalizedDependencies,
  });

  /*
   * ---------------------------------------------------
   * Create embedded task
   * ---------------------------------------------------
   */

  initiative.tasks.push({
    _id: taskId,

    title:
      title.trim(),

    description:
      description.trim(),

    phaseId,

    order:
      normalizedOrder,

    dependencies:
      normalizedDependencies,

    assignedOrganization,

    requiredSkills:
      Array.isArray(requiredSkills)
        ? requiredSkills
        : [],

    volunteerSlots:
      Number(volunteerSlots),

    scheduledStartAt:
      parsedStartAt,

    scheduledEndAt:
      parsedEndAt,
  });

  await initiative.save();

  return initiative.tasks.id(
    taskId
  );
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
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  ensureValidObjectId(
    taskId,
    "taskId"
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
   * ---------------------------------------------------
   * Authorization
   * ---------------------------------------------------
   */

  const canManage =
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

  const task =
    initiative.tasks.id(
      taskId
    );

  if (!task) {
    throw AppError.notFound(
      "Task not found."
    );
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

  const hasValidField =
    allowedFields.some(
      (field) =>
        payload[field] !==
        undefined
    );

  if (!hasValidField) {
    throw AppError.badRequest(
      "No valid task fields were provided."
    );
  }

  /*
   * ---------------------------------------------------
   * Phase
   * ---------------------------------------------------
   */

  const targetPhaseId =
    payload.phaseId !== undefined
      ? payload.phaseId
      : task.phaseId;

  if (
    payload.phaseId !== undefined
  ) {
    ensureValidObjectId(
      payload.phaseId,
      "phaseId"
    );

    const phase =
      initiative.phases.id(
        payload.phaseId
      );

    if (!phase) {
      throw AppError.badRequest(
        "The selected phase does not exist in this initiative."
      );
    }
  }

  /*
   * ---------------------------------------------------
   * Order
   * ---------------------------------------------------
   */

  const targetOrder =
    payload.order !== undefined
      ? Number(payload.order)
      : task.order;

  if (
    !Number.isInteger(
      targetOrder
    ) ||
    targetOrder < 1
  ) {
    throw AppError.badRequest(
      "Task order must be an integer of at least 1."
    );
  }

  const duplicateOrder =
    initiative.tasks.some(
      (otherTask) =>
        otherTask._id.toString() !==
          taskId.toString() &&
        otherTask.phaseId.toString() ===
          targetPhaseId.toString() &&
        otherTask.order ===
          targetOrder
    );

  if (duplicateOrder) {
    throw AppError.badRequest(
      "Another task in this phase already uses this order."
    );
  }

  /*
   * ---------------------------------------------------
   * Dependencies
   * ---------------------------------------------------
   */

  let normalizedDependencies =
    task.dependencies;

  if (
    payload.dependencies !==
    undefined
  ) {
    normalizedDependencies =
      await validateTaskDependencies({
        dependencies:
          payload.dependencies,

        initiative,

        currentTaskId:
          task._id,
      });

    ensureNoCircularTaskDependency({
      initiative,

      taskId:
        task._id,

      dependencies:
        normalizedDependencies,
    });
  }

  /*
   * ---------------------------------------------------
   * Dates
   * ---------------------------------------------------
   */

  const scheduledStartAt =
    payload.scheduledStartAt !==
    undefined
      ? payload.scheduledStartAt
        ? new Date(
            payload.scheduledStartAt
          )
        : null
      : task.scheduledStartAt;

  const scheduledEndAt =
    payload.scheduledEndAt !==
    undefined
      ? payload.scheduledEndAt
        ? new Date(
            payload.scheduledEndAt
          )
        : null
      : task.scheduledEndAt;

  if (
    scheduledStartAt &&
    Number.isNaN(
      scheduledStartAt.getTime()
    )
  ) {
    throw AppError.badRequest(
      "scheduledStartAt is invalid."
    );
  }

  if (
    scheduledEndAt &&
    Number.isNaN(
      scheduledEndAt.getTime()
    )
  ) {
    throw AppError.badRequest(
      "scheduledEndAt is invalid."
    );
  }

  if (
    scheduledStartAt &&
    scheduledEndAt &&
    scheduledEndAt <=
      scheduledStartAt
  ) {
    throw AppError.badRequest(
      "Task end date must be after start date."
    );
  }

  /*
   * ---------------------------------------------------
   * Validate basic editable fields
   * ---------------------------------------------------
   */

  if (
    payload.title !== undefined &&
    !payload.title?.trim()
  ) {
    throw AppError.badRequest(
      "Task title cannot be empty."
    );
  }

  if (
    payload.description !==
      undefined &&
    !payload.description?.trim()
  ) {
    throw AppError.badRequest(
      "Task description cannot be empty."
    );
  }

  if (
    payload.assignedOrganization
  ) {
    ensureValidObjectId(
      payload.assignedOrganization,
      "assignedOrganization"
    );
  }

  /*
   * ---------------------------------------------------
   * Apply fields AFTER validation
   * ---------------------------------------------------
   */

  if (
    payload.title !== undefined
  ) {
    task.title =
      payload.title.trim();
  }

  if (
    payload.description !==
    undefined
  ) {
    task.description =
      payload.description.trim();
  }

  task.phaseId =
    targetPhaseId;

  task.order =
    targetOrder;

  if (
    payload.dependencies !==
    undefined
  ) {
    task.dependencies =
      normalizedDependencies;
  }

  if (
    payload.assignedOrganization !==
    undefined
  ) {
    task.assignedOrganization =
      payload.assignedOrganization ||
      null;
  }

  if (
    payload.requiredSkills !==
    undefined
  ) {
    if (
      !Array.isArray(
        payload.requiredSkills
      )
    ) {
      throw AppError.badRequest(
        "requiredSkills must be an array."
      );
    }

    task.requiredSkills =
      payload.requiredSkills;
  }

  if (
    payload.volunteerSlots !==
    undefined
  ) {
    const volunteerSlots =
      Number(
        payload.volunteerSlots
      );

    if (
      !Number.isInteger(
        volunteerSlots
      ) ||
      volunteerSlots < 0
    ) {
      throw AppError.badRequest(
        "volunteerSlots must be a non-negative integer."
      );
    }

    task.volunteerSlots =
      volunteerSlots;
  }

  if (
    payload.scheduledStartAt !==
    undefined
  ) {
    task.scheduledStartAt =
      scheduledStartAt;
  }

  if (
    payload.scheduledEndAt !==
    undefined
  ) {
    task.scheduledEndAt =
      scheduledEndAt;
  }

  if (
    payload.status !== undefined
  ) {
    task.status =
      payload.status;
  }

  if (
    payload.progress !== undefined
  ) {
    const progress =
      Number(payload.progress);

    if (
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress > 100
    ) {
      throw AppError.badRequest(
        "Task progress must be between 0 and 100."
      );
    }

    task.progress =
      progress;
  }

  if (
    payload.isLocked !== undefined
  ) {
    task.isLocked =
      Boolean(payload.isLocked);
  }

  if (
    payload.lockReasons !==
    undefined
  ) {
    if (
      !Array.isArray(
        payload.lockReasons
      )
    ) {
      throw AppError.badRequest(
        "lockReasons must be an array."
      );
    }

    task.lockReasons =
      payload.lockReasons;
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
export const addResourceRequirementService =
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

    const canManage =
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
      currency = "USD",
      requiredFrom = null,
      requiredUntil = null,
      serviceArea = null,
    } = payload;

    /*
     * Required fields
     */

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

    const requiredQuantity =
      Number(quantityRequired);

    if (
      !Number.isFinite(
        requiredQuantity
      ) ||
      requiredQuantity <= 0
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

    /*
     * Estimated cost
     */

    if (
      estimatedCost !== null &&
      (
        !Number.isFinite(
          Number(estimatedCost)
        ) ||
        Number(estimatedCost) < 0
      )
    ) {
      throw AppError.badRequest(
        "estimatedCost cannot be negative."
      );
    }

    /*
     * Currency
     */

    const normalizedCurrency =
      currency
        ?.trim()
        .toUpperCase();

    if (
      !normalizedCurrency ||
      normalizedCurrency.length !== 3
    ) {
      throw AppError.badRequest(
        "currency must be a 3-letter currency code."
      );
    }

    /*
     * Dates
     */

    const from =
      requiredFrom
        ? new Date(requiredFrom)
        : null;

    const until =
      requiredUntil
        ? new Date(requiredUntil)
        : null;

    if (
      from &&
      Number.isNaN(from.getTime())
    ) {
      throw AppError.badRequest(
        "requiredFrom is invalid."
      );
    }

    if (
      until &&
      Number.isNaN(until.getTime())
    ) {
      throw AppError.badRequest(
        "requiredUntil is invalid."
      );
    }

    if (
      from &&
      until &&
      until <= from
    ) {
      throw AppError.badRequest(
        "requiredUntil must be after requiredFrom."
      );
    }

    /*
     * ResourceRequirements belonging to an approved
     * initiative may already be municipality verified.
     *
     * If you only want requirements created BEFORE
     * approval, always use false instead.
     */
    const isVerifiedRequest =
      initiative.status ===
        INITIATIVE_STATUSES.APPROVED ||
      initiative.status ===
        INITIATIVE_STATUSES.IN_PROGRESS;

    return ResourceRequirement.create({
      initiative:
        initiative._id,

      category:
        category.trim(),

      name:
        name.trim(),

      description:
        description?.trim() ||
        null,

      quantityRequired:
        requiredQuantity,

      quantityReserved: 0,

      unit:
        unit.trim(),

      estimatedCost:
        estimatedCost !== null
          ? Number(
              estimatedCost
            )
          : null,

      currency:
        normalizedCurrency,

      requiredFrom:
        from,

      requiredUntil:
        until,

      serviceArea:
        serviceArea?.trim() ||
        null,

      status:
        "unmet",

      isVerifiedRequest,
    });
  };
export const getResourceRequirementByIdService =
  async ({
    initiativeId,
    requirementId,
  }) => {
    ensureValidObjectId(
      initiativeId,
      "initiativeId"
    );

    ensureValidObjectId(
      requirementId,
      "requirementId"
    );

    const initiativeExists =
      await Initiative.exists({
        _id: initiativeId,
      });

    if (!initiativeExists) {
      throw AppError.notFound(
        "Initiative not found."
      );
    }

    const requirement =
      await ResourceRequirement.findOne({
        _id:
          requirementId,

        initiative:
          initiativeId,
      });

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
  ensureValidObjectId(
    initiativeId,
    "initiativeId"
  );

  ensureValidObjectId(
    requirementId,
    "requirementId"
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
          ].includes(
            membership.role
          ) &&
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
          ].includes(
            membership.role
          ) &&
          membership.organizationId.toString() ===
            initiative.leadOrganization.toString()
      ) ?? false;
  }

  if (!canManage) {
    throw AppError.forbidden(
      "You are not authorized to manage resource requirements for this initiative."
    );
  }

  /*
   * ---------------------------------------------------
   * Find standalone ResourceRequirement
   *
   * IMPORTANT:
   * Also verify that it belongs to this Initiative.
   * ---------------------------------------------------
   */

  const requirement =
    await ResourceRequirement.findOne({
      _id: requirementId,
      initiative: initiative._id,
    });

  if (!requirement) {
    throw AppError.notFound(
      "Resource requirement not found."
    );
  }

  /*
   * ---------------------------------------------------
   * User-editable fields only
   *
   * DO NOT expose:
   *
   * quantityReserved
   * status
   * isVerifiedRequest
   * reopenedAt
   * initiative
   *
   * Those are workflow-controlled.
   * ---------------------------------------------------
   */

  const allowedFields = [
    "category",
    "name",
    "description",
    "quantityRequired",
    "unit",
    "estimatedCost",
    "currency",
    "requiredFrom",
    "requiredUntil",
    "serviceArea",
  ];

  const hasValidField =
    allowedFields.some(
      (field) =>
        payload[field] !== undefined
    );

  if (!hasValidField) {
    throw AppError.badRequest(
      "No valid resource requirement fields were provided."
    );
  }

  /*
   * ---------------------------------------------------
   * Category
   * ---------------------------------------------------
   */

  if (
    payload.category !== undefined
  ) {
    if (!payload.category?.trim()) {
      throw AppError.badRequest(
        "Category cannot be empty."
      );
    }

    requirement.category =
      payload.category.trim();
  }

  /*
   * ---------------------------------------------------
   * Name
   * ---------------------------------------------------
   */

  if (
    payload.name !== undefined
  ) {
    if (!payload.name?.trim()) {
      throw AppError.badRequest(
        "Name cannot be empty."
      );
    }

    requirement.name =
      payload.name.trim();
  }

  /*
   * ---------------------------------------------------
   * Description
   * ---------------------------------------------------
   */

  if (
    payload.description !== undefined
  ) {
    requirement.description =
      payload.description?.trim() ||
      null;
  }

  /*
   * ---------------------------------------------------
   * Quantity Required
   * ---------------------------------------------------
   */

  if (
    payload.quantityRequired !==
    undefined
  ) {
    const quantityRequired =
      Number(
        payload.quantityRequired
      );

    if (
      !Number.isFinite(
        quantityRequired
      ) ||
      quantityRequired <= 0
    ) {
      throw AppError.badRequest(
        "quantityRequired must be greater than 0."
      );
    }

    /*
     * Example:
     *
     * currently reserved = 5
     * client tries quantityRequired = 3
     *
     * Not allowed because existing reservations
     * would exceed the requirement.
     */
    if (
      quantityRequired <
      requirement.quantityReserved
    ) {
      throw AppError.conflict(
        `quantityRequired cannot be lower than the currently reserved quantity (${requirement.quantityReserved}).`
      );
    }

    requirement.quantityRequired =
      quantityRequired;
  }

  /*
   * ---------------------------------------------------
   * Unit
   * ---------------------------------------------------
   */

  if (
    payload.unit !== undefined
  ) {
    if (!payload.unit?.trim()) {
      throw AppError.badRequest(
        "Unit cannot be empty."
      );
    }

    requirement.unit =
      payload.unit.trim();
  }

  /*
   * ---------------------------------------------------
   * Estimated Cost
   * ---------------------------------------------------
   */

  if (
    payload.estimatedCost !==
    undefined
  ) {
    if (
      payload.estimatedCost ===
      null
    ) {
      requirement.estimatedCost =
        null;
    } else {
      const estimatedCost =
        Number(
          payload.estimatedCost
        );

      if (
        !Number.isFinite(
          estimatedCost
        ) ||
        estimatedCost < 0
      ) {
        throw AppError.badRequest(
          "estimatedCost cannot be negative."
        );
      }

      requirement.estimatedCost =
        estimatedCost;
    }
  }

  /*
   * ---------------------------------------------------
   * Currency
   * ---------------------------------------------------
   */

  if (
    payload.currency !== undefined
  ) {
    const currency =
      payload.currency
        ?.trim()
        .toUpperCase();

    if (
      !currency ||
      currency.length !== 3
    ) {
      throw AppError.badRequest(
        "currency must be a valid 3-letter currency code."
      );
    }

    requirement.currency =
      currency;
  }

  /*
   * ---------------------------------------------------
   * Dates
   * ---------------------------------------------------
   */

  const requiredFrom =
    payload.requiredFrom !== undefined
      ? payload.requiredFrom
        ? new Date(
            payload.requiredFrom
          )
        : null
      : requirement.requiredFrom;

  const requiredUntil =
    payload.requiredUntil !== undefined
      ? payload.requiredUntil
        ? new Date(
            payload.requiredUntil
          )
        : null
      : requirement.requiredUntil;

  if (
    requiredFrom &&
    Number.isNaN(
      requiredFrom.getTime()
    )
  ) {
    throw AppError.badRequest(
      "requiredFrom is invalid."
    );
  }

  if (
    requiredUntil &&
    Number.isNaN(
      requiredUntil.getTime()
    )
  ) {
    throw AppError.badRequest(
      "requiredUntil is invalid."
    );
  }

  if (
    requiredFrom &&
    requiredUntil &&
    requiredUntil <= requiredFrom
  ) {
    throw AppError.badRequest(
      "requiredUntil must be after requiredFrom."
    );
  }

  requirement.requiredFrom =
    requiredFrom;

  requirement.requiredUntil =
    requiredUntil;

  /*
   * ---------------------------------------------------
   * Service Area
   * ---------------------------------------------------
   */

  if (
    payload.serviceArea !== undefined
  ) {
    requirement.serviceArea =
      payload.serviceArea?.trim() ||
      null;
  }

  /*
   * ---------------------------------------------------
   * Save RESOURCE REQUIREMENT
   *
   * NOT initiative.save()
   * ---------------------------------------------------
   */

  await requirement.save();

  return requirement;
};
export const deleteResourceRequirementService =
  async ({
    initiativeId,
    requirementId,
    authenticatedUser,
  }) => {
    ensureValidObjectId(
      initiativeId,
      "initiativeId"
    );

    ensureValidObjectId(
      requirementId,
      "requirementId"
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

    const canManage =
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
      await ResourceRequirement.findOne({
        _id:
          requirementId,

        initiative:
          initiative._id,
      });

    if (!requirement) {
      throw AppError.notFound(
        "Resource requirement not found."
      );
    }

    /*
     * ---------------------------------------------------
     * Task dependencies
     * ---------------------------------------------------
     *
     * task.schema.js should now use:
     *
     * dependency.resourceRequirement
     */

    const taskDependsOnRequirement =
      initiative.tasks.some(
        (task) =>
          task.dependencies?.some(
            (dependency) =>
              dependency.type ===
                DEPENDENCY_TYPES.RESOURCE &&
              dependency.resourceRequirement
                ?.toString() ===
                requirementId.toString()
          )
      );

    if (
      taskDependsOnRequirement
    ) {
      throw AppError.conflict(
        "This resource requirement cannot be deleted because one or more tasks depend on it."
      );
    }

    /*
     * ---------------------------------------------------
     * Check related ResourceRequests
     * ---------------------------------------------------
     */

    const hasResourceRequests =
      await ResourceRequest.exists({
        resourceRequirement:
          requirement._id,
      });

    if (hasResourceRequests) {
      throw AppError.conflict(
        "This resource requirement cannot be deleted because resource requests already reference it."
      );
    }

    /*
     * ---------------------------------------------------
     * Check reservations
     * ---------------------------------------------------
     */

    const hasReservations =
      await ResourceReservation.exists({
        resourceRequirement:
          requirement._id,
      });

    if (hasReservations) {
      throw AppError.conflict(
        "This resource requirement cannot be deleted because resource reservations already reference it."
      );
    }

    /*
     * ---------------------------------------------------
     * Check ContributionOffers
     * ---------------------------------------------------
     */

    const hasOffers =
      await ContributionOffer.exists({
        "items.resourceRequirement":
          requirement._id,
      });

    if (hasOffers) {
      throw AppError.conflict(
        "This resource requirement cannot be deleted because contribution offers already reference it."
      );
    }

    await requirement.deleteOne();

    return {
      deletedRequirementId:
        requirement._id,
    };
  };
export const reviewInitiativeApprovalService =
  async ({
    initiativeId,
    decision,
    notes,
    authenticatedUser,
  }) => {
    ensureValidObjectId(
      initiativeId,
      "initiativeId"
    );

    /*
     * ---------------------------------------------
     * Validate decision
     * ---------------------------------------------
     */

    const allowedDecisions = [
      "approved",
      "rejected",
      "changes_requested",
    ];

    if (
      !allowedDecisions.includes(
        decision
      )
    ) {
      throw AppError.badRequest(
        "Invalid initiative approval decision."
      );
    }

    /*
     * ---------------------------------------------
     * Find Initiative
     * ---------------------------------------------
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
     * ---------------------------------------------
     * Reviewable states
     * ---------------------------------------------
     */

    if (
      initiative.status !==
        INITIATIVE_STATUSES.SUBMITTED &&
      initiative.status !==
        INITIATIVE_STATUSES.CHANGES_REQUESTED
    ) {
      throw AppError.badRequest(
        "Only submitted initiatives or initiatives with requested changes can be reviewed."
      );
    }

    /*
     * ---------------------------------------------
     * Authorization
     *
     * Municipality OWNER / ADMIN only.
     * The municipality must be the one responsible
     * for this Initiative.
     * ---------------------------------------------
     */

    const canReview =
      authenticatedUser.accountType ===
        USER_ROLES.MUNICIPALITY &&
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
              initiative.municipality.toString()
        ) ?? false
      );

    if (!canReview) {
      throw AppError.forbidden(
        "You are not authorized to review this initiative."
      );
    }

    /*
     * ---------------------------------------------
     * Save approval snapshot
     * ---------------------------------------------
     */

    initiative.approval = {
      decision,

      reviewedBy:
        authenticatedUser._id,

      notes:
        notes?.trim() || null,

      reviewedAt:
        new Date(),

      revisionNumber:
        (
          initiative.approval
            ?.revisionNumber ?? 0
        ) + 1,
    };

    /*
     * Ensure readiness exists.
     *
     * This also protects older DB documents that
     * may have been created before readiness existed.
     */
    if (!initiative.readiness) {
      initiative.readiness = {};
    }

    /*
     * =============================================
     * APPROVED
     * =============================================
     */

    if (
      decision === "approved"
    ) {
      initiative.status =
        INITIATIVE_STATUSES.APPROVED;

      initiative.readiness
        .municipalityApproved = true;

      /*
       * ResourceRequirement is now standalone.
       *
       * Verify requirements that may still
       * participate in resource matching.
       */
      await ResourceRequirement.updateMany(
        {
          initiative:
            initiative._id,

          status: {
            $nin: [
              "cancelled",
              "delivered",
            ],
          },
        },
        {
          $set: {
            isVerifiedRequest: true,
          },
        }
      );
    }

    /*
     * =============================================
     * REJECTED
     * =============================================
     */

    if (
      decision === "rejected"
    ) {
      initiative.status =
        INITIATIVE_STATUSES.REJECTED;

      initiative.readiness
        .municipalityApproved = false;

      /*
       * Requirements from a rejected Initiative
       * must not be exposed to resource matching.
       */
      await ResourceRequirement.updateMany(
        {
          initiative:
            initiative._id,
        },
        {
          $set: {
            isVerifiedRequest: false,
          },
        }
      );
    }

    /*
     * =============================================
     * CHANGES REQUESTED
     * =============================================
     */

    if (
      decision ===
      "changes_requested"
    ) {
      initiative.status =
        INITIATIVE_STATUSES
          .CHANGES_REQUESTED;

      initiative.readiness
        .municipalityApproved = false;

      /*
       * Requirement data may change while the
       * Initiative is revised, therefore it must
       * not remain verified.
       */
      await ResourceRequirement.updateMany(
        {
          initiative:
            initiative._id,
        },
        {
          $set: {
            isVerifiedRequest: false,
          },
        }
      );
    }

    /*
     * ---------------------------------------------
     * Refresh readiness timestamp
     *
     * resourcesSatisfied and dependenciesSatisfied
     * will be recalculated later by the dedicated
     * readiness service.
     * ---------------------------------------------
     */

    initiative.readiness.calculatedAt =
      new Date();

    await initiative.save();

    return initiative;
  };


export const filterInitiativesService =
  async ({
    query,
    authenticatedUser,
  }) => {
    const {
      leadOrganization,
      municipality,
      title,
      tags,
      status,
      actualStartAt,
      actualEndAt,
      plannedStartAt,
      plannedEndAt,
    } = query;

    const filter = {};

    /*
     * -----------------------------------------
     * Lead Organization
     * -----------------------------------------
     */

    if (leadOrganization) {
      ensureValidObjectId(
        leadOrganization,
        "leadOrganization"
      );

      filter.leadOrganization =
        leadOrganization;
    }

    /*
     * -----------------------------------------
     * Municipality
     * -----------------------------------------
     */

    if (municipality) {
      ensureValidObjectId(
        municipality,
        "municipality"
      );

      filter.municipality =
        municipality;
    }

    /*
     * -----------------------------------------
     * Partial title search
     *
     * Example:
     * ?title=park
     *
     * matches:
     * "Green Park Restoration"
     * "Park Cleanup Initiative"
     * -----------------------------------------
     */
    //escapeRegex sanitizes user's input before giving it to regex
    //regex: pattern matching
    // if user does .* => match everything
    //park=> park
    // park. => park\. => mongodb interprets . as actual period



    if (title?.trim()) {
      filter.title = {
        $regex:
          escapeRegex(title.trim()),
        $options: "i",
      };
    }

    /*
     * -----------------------------------------
     * Tags
     *
     * URL:
     * ?tags=environment,cleanup
     *
     * $in means at least one tag matches.
     * -----------------------------------------
     */



    if (tags) {
      const parsedTags =
        String(tags)
          .split(",")
          .map((tag) =>
            tag.trim().toLowerCase()
          )
          .filter(Boolean);
          //keep actual strings, not empty elements, or undefined, or null 

      if (parsedTags.length > 0) {
        filter.tags = {
          $in: parsedTags,
        };
      }
    }

    /*
     * -----------------------------------------
     * Status
     * -----------------------------------------
     */

    if (status) {
      if (
        !Object.values(
          INITIATIVE_STATUSES
        ).includes(status)
      ) {
        throw AppError.badRequest(
          "Invalid initiative status."
        );
      }

      filter.status = status;
    }

    /*
     * -----------------------------------------
     * Actual Start Date
     *
     
     * -----------------------------------------
     */


    if (actualStartAt) {
      const date =
        new Date(actualStartAt);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        throw AppError.badRequest(
          "actualStartAt is invalid."
        );
      }

      /*
       * Search that entire calendar day.
       */
      const nextDay =
        new Date(date);

      nextDay.setUTCDate(
        nextDay.getUTCDate() + 1
      );

      filter[
        "executionPeriod.actualStartAt"
      ] = {
        $gte: date,
        $lt: nextDay,
      };
    }

    /*
 * -----------------------------------------
 * Actual End
 * -----------------------------------------
 */

if (actualEndAt) {
  const date = new Date(actualEndAt);

  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(
      "actualEndAt is invalid."
    );
  }

  filter[
    "executionPeriod.actualEndAt"
  ] = {
    $lte: date,
  };
}
    /*
     * -----------------------------------------
     * Planned Start
     * -----------------------------------------
     */

    if (plannedStartAt) {
      const date =
        new Date(plannedStartAt);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        throw AppError.badRequest(
          "plannedStartAt is invalid."
        );
      }

      filter[
        "executionPeriod.plannedStartAt"
      ] = {
        $gte: date,
      };
    }

    /*
     * -----------------------------------------
     * Planned End
     * -----------------------------------------
     */

    if (plannedEndAt) {
      const date =
        new Date(plannedEndAt);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        throw AppError.badRequest(
          "plannedEndAt is invalid."
        );
      }

      filter[
        "executionPeriod.plannedEndAt"
      ] = {
        $lte: date,
      };
    }

    if (
  plannedStartAt &&
  plannedEndAt &&
  new Date(plannedEndAt) <
    new Date(plannedStartAt)
) {
  throw AppError.badRequest(
    "plannedEndAt cannot be before plannedStartAt."
  );
}

if (
  actualStartAt &&
  actualEndAt &&
  new Date(actualEndAt) <
    new Date(actualStartAt)
) {
  throw AppError.badRequest(
    "actualEndAt cannot be before actualStartAt."
  );
}

    /*
     * -----------------------------------------
     * Query
     * -----------------------------------------
     */

    const initiatives =
      await Initiative.find(filter)
        .populate(
          "municipality",
          "name organizationType"
        )
        .populate(
          "leadOrganization",
          "name organizationType"
        )
        .populate(
          "createdBy",
          "firstName lastName email accountType"
        )
        .sort({
          createdAt: -1,
        });

    return initiatives;
  };

