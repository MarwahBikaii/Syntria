import mongoose from "mongoose";

import connectDB from "../database.js";

import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";

import { WorkItem } from "../models/work-item.model.js";
import { Issue } from "../models/issue.model.js";
import { Initiative } from "../models/initiative.model.js";

import { Resource } from "../models/resource.model.js";
import { ContributionOffer } from "../models/contribution-offer.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
import { VolunteerApplication } from "../models/volunteer-application.model.js";
import { ExecutionEvent } from "../models/execution-event.model.js";
import { Notification } from "../models/notification.model.js";

import {
  ISSUE_STATUSES,
  INITIATIVE_STATUSES,
  READINESS_STATUSES,
  TASK_STATUSES,
  DEPENDENCY_TYPES,
  MUNICIPALITY_REVIEW_DECISIONS,
  OFFER_STATUSES,
  APPLICATION_STATUSES,
} from "../constants/enums.js";

const { ObjectId } = mongoose.Types;

/*
 * ============================================================
 * Helper functions
 * ============================================================
 */

const requireUser = (usersByEmail, email) => {
  const user = usersByEmail.get(email);

  if (!user) {
    throw new Error(
      `Required existing user was not found: ${email}`
    );
  }

  return user;
};

const getFirstOrganizationId = (user) => {
  const organizationId =
    user.memberships?.[0]?.organizationId;

  if (!organizationId) {
    throw new Error(
      `User ${user.email} does not have an organization membership.`
    );
  }

  return organizationId;
};

/*
 * ============================================================
 * Seed database
 * ============================================================
 */

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("Connected to MongoDB.");

    /*
     * ========================================================
     * Load EXISTING users
     * ========================================================
     *
     * Users are NOT created or deleted by this seed.
     */

    const requiredEmails = [
      "ahmad.municipality@syntria.test",
      "layla.municipality@syntria.test",

      "rana.greenfuture@syntria.test",
      "samer.greenfuture@syntria.test",

      "nour.communitycare@syntria.test",
      "karim.multiorg@syntria.test",

      "maya.equipment@syntria.test",
      "joseph.equipment@syntria.test",

      "dalia.medical@syntria.test",

      "omar.member@syntria.test",
      "sara.member@syntria.test",
      "tarek.member@syntria.test",
    ];

    const existingUsers = await User.find({
      email: {
        $in: requiredEmails,
      },
    });

    const usersByEmail = new Map(
      existingUsers.map((user) => [
        user.email,
        user,
      ])
    );

    /*
     * Verify every required test user exists.
     */
    for (const email of requiredEmails) {
      requireUser(usersByEmail, email);
    }

    console.log(
      `${existingUsers.length} required existing users found.`
    );

    /*
     * ========================================================
     * Resolve users
     * ========================================================
     */

    const ahmad = requireUser(
      usersByEmail,
      "ahmad.municipality@syntria.test"
    );

    const layla = requireUser(
      usersByEmail,
      "layla.municipality@syntria.test"
    );

    const rana = requireUser(
      usersByEmail,
      "rana.greenfuture@syntria.test"
    );

    const samer = requireUser(
      usersByEmail,
      "samer.greenfuture@syntria.test"
    );

    const nour = requireUser(
      usersByEmail,
      "nour.communitycare@syntria.test"
    );

    const karim = requireUser(
      usersByEmail,
      "karim.multiorg@syntria.test"
    );

    const maya = requireUser(
      usersByEmail,
      "maya.equipment@syntria.test"
    );

    const joseph = requireUser(
      usersByEmail,
      "joseph.equipment@syntria.test"
    );

    const dalia = requireUser(
      usersByEmail,
      "dalia.medical@syntria.test"
    );

    const omar = requireUser(
      usersByEmail,
      "omar.member@syntria.test"
    );

    const sara = requireUser(
      usersByEmail,
      "sara.member@syntria.test"
    );

    const tarek = requireUser(
      usersByEmail,
      "tarek.member@syntria.test"
    );

    /*
     * ========================================================
     * Resolve EXISTING organizations from user memberships
     * ========================================================
     */

    const tripoliMunicipalityId =
      getFirstOrganizationId(ahmad);

    const greenFutureId =
      getFirstOrganizationId(rana);

    const communityCareId =
      getFirstOrganizationId(nour);

    const equipmentSupportId =
      getFirstOrganizationId(maya);

    const medicalSuppliesId =
      getFirstOrganizationId(dalia);

    /*
     * Verify organizations still exist.
     */
    const organizationIds = [
      tripoliMunicipalityId,
      greenFutureId,
      communityCareId,
      equipmentSupportId,
      medicalSuppliesId,
    ];

    const existingOrganizations =
      await Organization.find({
        _id: {
          $in: organizationIds,
        },
      });

    if (
      existingOrganizations.length !==
      organizationIds.length
    ) {
      throw new Error(
        "One or more organizations referenced by the existing users do not exist."
      );
    }

    console.log(
      `${existingOrganizations.length} existing organizations verified.`
    );

    /*
     * ========================================================
     * Clear ONLY application/test data
     * ========================================================
     *
     * IMPORTANT:
     * Users and organizations are NOT deleted.
     */

    await Notification.deleteMany({});
    await ExecutionEvent.deleteMany({});
    await VolunteerApplication.deleteMany({});
    await ResourceReservation.deleteMany({});
    await ContributionOffer.deleteMany({});
    await Resource.deleteMany({});

    /*
     * Issues + Initiatives use the WorkItem collection.
     */
    await WorkItem.deleteMany({});

    console.log(
      "Existing work items and application test data cleared."
    );

    /*
     * ========================================================
     * Resources
     * ========================================================
     */

    const resources = await Resource.create([
      {
        ownerOrganization:
          equipmentSupportId,

        name: "Industrial Waste Containers",

        description:
          "Large reusable waste containers available for environmental cleanup initiatives.",

        category: "cleanup_equipment",

        resourceType: "equipment",

        totalQuantity: 20,

        unit: "containers",

        serviceAreas: [
          "Tripoli",
          "Mina",
          "North Lebanon",
        ],

        availabilityWindows: [
          {
            startAt: new Date(
              "2026-08-15T08:00:00Z"
            ),

            endAt: new Date(
              "2026-12-31T18:00:00Z"
            ),

            availableQuantity: 20,
          },
        ],

        status: "available",

        isActive: true,
      },

      {
        ownerOrganization:
          equipmentSupportId,

        name: "Heavy Duty Cleanup Bags",

        description:
          "Industrial cleanup bags suitable for community cleanup campaigns.",

        category: "cleanup_materials",

        resourceType: "material",

        totalQuantity: 500,

        unit: "bags",

        serviceAreas: [
          "Tripoli",
          "Mina",
        ],

        availabilityWindows: [
          {
            startAt: new Date(
              "2026-08-15T08:00:00Z"
            ),

            endAt: new Date(
              "2026-11-30T18:00:00Z"
            ),

            availableQuantity: 500,
          },
        ],

        status: "available",

        isActive: true,
      },

      {
        ownerOrganization:
          equipmentSupportId,

        name: "Transport Van",

        description:
          "Cargo van available for transporting equipment, volunteers, and collected materials.",

        category: "transportation",

        resourceType: "vehicle",

        totalQuantity: 2,

        unit: "vehicles",

        serviceAreas: [
          "Tripoli",
          "Mina",
          "Zgharta",
        ],

        availabilityWindows: [
          {
            startAt: new Date(
              "2026-08-20T06:00:00Z"
            ),

            endAt: new Date(
              "2026-12-20T20:00:00Z"
            ),

            availableQuantity: 2,
          },
        ],

        status: "available",

        isActive: true,
      },

      {
        ownerOrganization:
          medicalSuppliesId,

        name: "First Aid Safety Kits",

        description:
          "First aid kits containing basic medical and emergency response supplies.",

        category: "health_and_safety",

        resourceType: "material",

        totalQuantity: 50,

        unit: "kits",

        serviceAreas: [
          "Tripoli",
          "Mina",
        ],

        availabilityWindows: [
          {
            startAt: new Date(
              "2026-08-15T08:00:00Z"
            ),

            endAt: new Date(
              "2026-12-31T18:00:00Z"
            ),

            availableQuantity: 50,
          },
        ],

        status: "available",

        isActive: true,
      },
    ]);

    const [
      wasteContainers,
      cleanupBags,
      transportVan,
      firstAidKits,
    ] = resources;

    console.log(
      `${resources.length} resources created.`
    );

    /*
     * ========================================================
     * Issue 1
     *
     * Submitted environmental issue.
     * Useful for:
     * - issue CRUD
     * - support issue
     * - remove support
     * - municipality review
     * ========================================================
     */

    const wasteIssue = await Issue.create({
      title:
        "Waste accumulation near public park",

      description:
        "Large amounts of household waste have accumulated near the public park and surrounding residential streets, creating sanitation and environmental concerns.",

      location: {
        address:
          "Public Park Area, Tripoli",

        district: "Al Mina",

        city: "Tripoli",

        country: "Lebanon",

        coordinates: {
          type: "Point",

          coordinates: [
            35.8262,
            34.4475,
          ],
        },
      },

      municipality:
        tripoliMunicipalityId,

      createdBy: omar._id,

      tags: [
        "waste",
        "environment",
        "cleanup",
        "public-health",
      ],

      status:
        ISSUE_STATUSES.SUBMITTED,

      category: "environment",

      priority: "high",

      aiAnalysis: {
        category:
          "Environmental Waste",

        priority: "high",

        suggestedDepartment:
          "Environmental Services",

        summary:
          "The reported issue concerns waste accumulation requiring coordinated cleanup and waste collection resources.",

        initiativeRecommendation: {
          shouldBecomeInitiative: true,

          reason:
            "The issue may require volunteers, equipment, transportation, and coordination between multiple organizations.",
        },

        confidenceScore: 0.93,

        modelName:
          "syntria-ai-test-model",

        analyzedAt: new Date(),
      },

      duplicateCandidates: [],

      duplicateDecision:
        "no_duplicate",

      supportedExistingIssue: null,

      supporting_users: [
        sara._id,
        tarek._id,
      ],

      /*
       * No decision yet.
       */
      municipalityReview: null,

      convertedInitiative: null,

      resolvedInternallyAt: null,
    });

    /*
     * ========================================================
     * Issue 2
     *
     * Duplicate issue where citizen chose
     * to support existing issue.
     * ========================================================
     */

    const duplicateWasteIssue =
      await Issue.create({
        title:
          "Garbage problem near Mina park",

        description:
          "Waste and garbage are continuing to accumulate around the Mina public park and nearby residential area.",

        location: {
          address:
            "Mina Public Park Area",

          district: "Al Mina",

          city: "Tripoli",

          country: "Lebanon",

          coordinates: {
            type: "Point",

            coordinates: [
              35.8264,
              34.4478,
            ],
          },
        },

        municipality:
          tripoliMunicipalityId,

        createdBy: sara._id,

        tags: [
          "garbage",
          "cleanup",
          "environment",
        ],

        status:
          ISSUE_STATUSES.CLOSED,

        category: "environment",

        priority: "medium",

        duplicateCandidates: [
          {
            issue: wasteIssue._id,

            similarityScore: 0.94,

            reasons: [
              "Similar geographic location",
              "Similar waste-related description",
              "Same municipality",
            ],

            detectedAt: new Date(),
          },
        ],

        duplicateDecision:
          "supported_existing",

        supportedExistingIssue:
          wasteIssue._id,

        supporting_users: [],

        municipalityReview: null,
      });

    /*
     * ========================================================
     * Issue 3
     *
     * Municipality resolved internally.
     * ========================================================
     */

    const streetLightIssue =
      await Issue.create({
        title:
          "Broken street lighting on residential road",

        description:
          "Several street lights are not functioning along a residential road, reducing visibility and creating safety concerns at night.",

        location: {
          address:
            "Azmi Street, Tripoli",

          district: "Azmi",

          city: "Tripoli",

          country: "Lebanon",

          coordinates: {
            type: "Point",

            coordinates: [
              35.8415,
              34.4332,
            ],
          },
        },

        municipality:
          tripoliMunicipalityId,

        createdBy: tarek._id,

        tags: [
          "street-light",
          "infrastructure",
          "safety",
        ],

        status:
          ISSUE_STATUSES
            .RESOLVED_INTERNALLY,

        category: "infrastructure",

        priority: "medium",

        duplicateDecision:
          "no_duplicate",

        supporting_users: [],

        municipalityReview: {
          decision:
            MUNICIPALITY_REVIEW_DECISIONS
              .RESOLVE_INTERNALLY,

          reviewedBy: layla._id,

          notes:
            "Municipality maintenance department can resolve this directly without creating a community initiative.",

          reviewedAt: new Date(
            "2026-08-09T10:00:00Z"
          ),
        },

        resolvedInternallyAt:
          new Date(
            "2026-08-10T12:00:00Z"
          ),
      });

    /*
     * ========================================================
     * Issue 4
     *
     * Converted into an initiative.
     * ========================================================
     */

    const convertedIssue =
      await Issue.create({
        title:
          "Pollution and waste along coastal area",

        description:
          "Plastic waste, discarded materials, and other debris are accumulating along part of the Tripoli coastline and require a coordinated community cleanup response.",

        location: {
          address:
            "Tripoli Coastal Area",

          district: "Al Mina",

          city: "Tripoli",

          country: "Lebanon",

          coordinates: {
            type: "Point",

            coordinates: [
              35.8098,
              34.4537,
            ],
          },
        },

        municipality:
          tripoliMunicipalityId,

        createdBy: omar._id,

        tags: [
          "coast",
          "pollution",
          "cleanup",
          "environment",
        ],

        status:
          ISSUE_STATUSES
            .CONVERTED_TO_INITIATIVE,

        category: "environment",

        priority: "high",

        duplicateDecision:
          "no_duplicate",

        supporting_users: [
          sara._id,
        ],

        municipalityReview: {
          decision:
            MUNICIPALITY_REVIEW_DECISIONS
              .CONVERT_TO_INITIATIVE,

          reviewedBy: ahmad._id,

          notes:
            "The issue requires resources, volunteers, multiple tasks, and coordination with a community organization.",

          reviewedAt: new Date(
            "2026-08-08T09:30:00Z"
          ),
        },

        convertedInitiative: null,
      });

    console.log(
      "4 issues created."
    );

    /*
     * ========================================================
     * Generate embedded IDs
     * ========================================================
     *
     * We manually create these ObjectIds because:
     *
     * Task.phaseId references an embedded phase.
     *
     * Dependencies and ContributionOffer reference
     * embedded resourceRequirement IDs.
     */

    const planningPhaseId =
      new ObjectId();

    const cleanupPhaseId =
      new ObjectId();

    const reportingPhaseId =
      new ObjectId();

    const prepareTaskId =
      new ObjectId();

    const cleanupTaskId =
      new ObjectId();

    const reportTaskId =
      new ObjectId();

    const bagsRequirementId =
      new ObjectId();

    const containerRequirementId =
      new ObjectId();

    const medicalRequirementId =
      new ObjectId();

    /*
     * ========================================================
     * Main initiative
     * ========================================================
     */

    const coastalCleanupInitiative =
      await Initiative.create({
        title:
          "Tripoli Coastal Cleanup Campaign",

        description:
          "A coordinated environmental initiative led by Green Future NGO to remove waste from the Tripoli coastline, mobilize volunteers, secure cleanup resources, and document environmental impact.",

        location: {
          address:
            "Tripoli Coastal Area",

          district: "Al Mina",

          city: "Tripoli",

          country: "Lebanon",

          coordinates: {
            type: "Point",

            coordinates: [
              35.8098,
              34.4537,
            ],
          },
        },

        municipality:
          tripoliMunicipalityId,

        createdBy: rana._id,

        tags: [
          "environment",
          "coastal-cleanup",
          "volunteers",
          "sustainability",
        ],

        status:
          INITIATIVE_STATUSES.APPROVED,

        sourceIssue:
          convertedIssue._id,

        leadOrganization:
          greenFutureId,

        expectedOutcome:
          "Remove accumulated waste from the targeted coastal area, engage local volunteers, improve environmental conditions, and document the amount of waste collected.",

        executionPeriod: {
          plannedStartAt:
            new Date(
              "2026-09-01T07:00:00Z"
            ),

          plannedEndAt:
            new Date(
              "2026-09-20T17:00:00Z"
            ),
        },

        /*
         * ----------------------------
         * Embedded phases
         * ----------------------------
         */

        phases: [
          {
            _id: planningPhaseId,

            name:
              "Preparation and Coordination",

            description:
              "Prepare resources, volunteers, logistics, and safety requirements.",

            order: 1,

            scheduledStartAt:
              new Date(
                "2026-09-01T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-05T17:00:00Z"
              ),

            status: "active",
          },

          {
            _id: cleanupPhaseId,

            name:
              "Coastal Cleanup Execution",

            description:
              "Deploy volunteers and resources to perform the physical cleanup.",

            order: 2,

            scheduledStartAt:
              new Date(
                "2026-09-06T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-15T17:00:00Z"
              ),

            status: "pending",
          },

          {
            _id: reportingPhaseId,

            name:
              "Impact Review and Reporting",

            description:
              "Measure results, organize evidence, and prepare final initiative reporting.",

            order: 3,

            scheduledStartAt:
              new Date(
                "2026-09-16T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-20T17:00:00Z"
              ),

            status: "pending",
          },
        ],

        /*
         * ----------------------------
         * Embedded tasks
         * ----------------------------
         */

        tasks: [
          {
            _id: prepareTaskId,

            title:
              "Prepare volunteers and cleanup zone",

            description:
              "Coordinate volunteer registration, define cleanup zones, and communicate safety instructions.",

            phaseId:
              planningPhaseId,

            order: 1,

            status:
              TASK_STATUSES.AVAILABLE,

            dependencies: [],

            assignedOrganization:
              greenFutureId,

            requiredSkills: [
              "community outreach",
              "event support",
            ],

            volunteerSlots: 10,

            progress: 20,

            scheduledStartAt:
              new Date(
                "2026-09-01T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-05T17:00:00Z"
              ),

            isLocked: false,

            lockReasons: [],
          },

          {
            _id: cleanupTaskId,

            title:
              "Execute coastal cleanup",

            description:
              "Deploy volunteers to collect and separate waste from the defined coastal cleanup zones.",

            phaseId:
              cleanupPhaseId,

            order: 2,

            status:
              TASK_STATUSES.LOCKED,

            dependencies: [
              {
                type:
                  DEPENDENCY_TYPES.TASK,

                taskId:
                  prepareTaskId,

                description:
                  "Preparation task must be completed first.",
              },

              {
                type:
                  DEPENDENCY_TYPES.RESOURCE,

                resourceRequirementId:
                  bagsRequirementId,

                description:
                  "Cleanup bags must be sufficiently reserved before execution.",
              },
            ],

            assignedOrganization:
              greenFutureId,

            requiredSkills: [
              "recycling",
              "community outreach",
            ],

            volunteerSlots: 25,

            progress: 0,

            scheduledStartAt:
              new Date(
                "2026-09-06T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-15T17:00:00Z"
              ),

            isLocked: true,

            lockReasons: [
              "Preparation task not completed",
              "Required cleanup resources are not fully reserved",
            ],
          },

          {
            _id: reportTaskId,

            title:
              "Document cleanup impact",

            description:
              "Collect photos, cleanup statistics, volunteer participation figures, and prepare the final impact report.",

            phaseId:
              reportingPhaseId,

            order: 3,

            status:
              TASK_STATUSES.LOCKED,

            dependencies: [
              {
                type:
                  DEPENDENCY_TYPES.TASK,

                taskId:
                  cleanupTaskId,

                description:
                  "Cleanup execution must be completed first.",
              },
            ],

            assignedOrganization:
              greenFutureId,

            requiredSkills: [
              "photography",
              "public awareness",
            ],

            volunteerSlots: 3,

            progress: 0,

            scheduledStartAt:
              new Date(
                "2026-09-16T07:00:00Z"
              ),

            scheduledEndAt:
              new Date(
                "2026-09-20T17:00:00Z"
              ),

            isLocked: true,

            lockReasons: [
              "Cleanup task has not been completed",
            ],
          },
        ],

        /*
         * ----------------------------
         * Resource requirements
         * ----------------------------
         */

        resourceRequirements: [
          {
            _id:
              bagsRequirementId,

            category:
              "cleanup_materials",

            name:
              "Heavy Duty Cleanup Bags",

            description:
              "Heavy duty bags required for waste collection.",

            quantityRequired: 150,

            quantityReserved: 70,

            unit: "bags",

            estimatedCost: 180,

            requiredFrom:
              new Date(
                "2026-09-05T07:00:00Z"
              ),

            requiredUntil:
              new Date(
                "2026-09-15T18:00:00Z"
              ),

            serviceArea:
              "Tripoli",

            status:
              "partially_met",

            isVerifiedRequest: true,
          },

          {
            _id:
              containerRequirementId,

            category:
              "cleanup_equipment",

            name:
              "Waste Containers",

            description:
              "Large waste containers required for temporary collection and transfer.",

            quantityRequired: 8,

            quantityReserved: 0,

            unit: "containers",

            estimatedCost: 800,

            requiredFrom:
              new Date(
                "2026-09-05T07:00:00Z"
              ),

            requiredUntil:
              new Date(
                "2026-09-15T18:00:00Z"
              ),

            serviceArea:
              "Tripoli",

            status: "unmet",

            isVerifiedRequest: true,
          },

          {
            _id:
              medicalRequirementId,

            category:
              "health_and_safety",

            name:
              "First Aid Safety Kits",

            description:
              "Safety kits for volunteers during cleanup activities.",

            quantityRequired: 10,

            quantityReserved: 0,

            unit: "kits",

            estimatedCost: 300,

            requiredFrom:
              new Date(
                "2026-09-05T07:00:00Z"
              ),

            requiredUntil:
              new Date(
                "2026-09-15T18:00:00Z"
              ),

            serviceArea:
              "Tripoli",

            status: "unmet",

            isVerifiedRequest: true,
          },
        ],

        /*
         * Already available resources.
         */

        availableResources: [
          {
            resource:
              cleanupBags._id,

            quantity: 70,

            notes:
              "Reserved through accepted contribution offer.",
          },
        ],

        /*
         * ----------------------------
         * Municipality approval
         * ----------------------------
         */

        approval: {
          decision: "approved",

          reviewedBy:
            ahmad._id,

          notes:
            "Initiative approved subject to remaining resource requirements being satisfied.",

          reviewedAt:
            new Date(
              "2026-08-10T09:00:00Z"
            ),

          revisionNumber: 0,
        },

        readiness: {
          status:
            READINESS_STATUSES
              .PARTIALLY_RESOURCED,

          municipalityApproved: true,

          resourcesSatisfied: false,

          dependenciesSatisfied: false,

          blockingReasons: [
            "Waste container requirement is not satisfied",
            "First aid kit requirement is not satisfied",
          ],

          calculatedAt: new Date(),
        },

        inspections: [],

        impactMetrics: [],
      });

    /*
     * Link source issue back to initiative.
     */

    convertedIssue.convertedInitiative =
      coastalCleanupInitiative._id;

    await convertedIssue.save();

    console.log(
      "Main approved initiative created."
    );

    /*
     * ========================================================
     * Draft initiative
     *
     * Useful for CRUD testing without affecting
     * the approved initiative.
     * ========================================================
     */

    const draftPhaseId =
      new ObjectId();

    const draftTaskId =
      new ObjectId();

    const draftRequirementId =
      new ObjectId();

    const draftInitiative =
      await Initiative.create({
        title:
          "Community Garden Development",

        description:
          "Draft community initiative for developing a small shared garden and volunteer-managed green space in Tripoli.",

        location: {
          address:
            "Community Center Area, Tripoli",

          district: "Tripoli",

          city: "Tripoli",

          country: "Lebanon",

          coordinates: {
            type: "Point",

            coordinates: [
              35.8380,
              34.4350,
            ],
          },
        },

        municipality:
          tripoliMunicipalityId,

        createdBy:
          karim._id,

        tags: [
          "community",
          "garden",
          "environment",
        ],

        status:
          INITIATIVE_STATUSES.DRAFT,

        sourceIssue: null,

        leadOrganization:
          communityCareId,

        expectedOutcome:
          "Create a community-managed green area that encourages volunteering and neighborhood engagement.",

        executionPeriod: {
          plannedStartAt:
            new Date(
              "2026-10-01T08:00:00Z"
            ),

          plannedEndAt:
            new Date(
              "2026-11-15T17:00:00Z"
            ),
        },

        phases: [
          {
            _id:
              draftPhaseId,

            name:
              "Garden Preparation",

            description:
              "Prepare the location before planting begins.",

            order: 1,

            status: "pending",
          },
        ],

        tasks: [
          {
            _id:
              draftTaskId,

            title:
              "Prepare garden site",

            description:
              "Clean and prepare the selected community garden location.",

            phaseId:
              draftPhaseId,

            order: 1,

            status:
              TASK_STATUSES.LOCKED,

            dependencies: [],

            assignedOrganization:
              communityCareId,

            requiredSkills: [
              "community outreach",
            ],

            volunteerSlots: 5,

            progress: 0,

            isLocked: true,

            lockReasons: [
              "Initiative has not been submitted and approved",
            ],
          },
        ],

        resourceRequirements: [
          {
            _id:
              draftRequirementId,

            category:
              "gardening_materials",

            name:
              "Gardening Tools",

            description:
              "Basic gardening tools required to prepare the community garden.",

            quantityRequired: 10,

            quantityReserved: 0,

            unit: "tools",

            estimatedCost: 250,

            serviceArea:
              "Tripoli",

            status: "unmet",

            isVerifiedRequest: false,
          },
        ],

        availableResources: [],

        inspections: [],

        impactMetrics: [],
      });

    console.log(
      "Draft initiative created."
    );

    /*
     * ========================================================
     * Contribution Offer
     * ========================================================
     */

    const contributionOffer =
      await ContributionOffer.create({
        initiative:
          coastalCleanupInitiative._id,

        partnerOrganization:
          equipmentSupportId,

        submittedBy:
          maya._id,

        items: [
          {
            resourceRequirementId:
              bagsRequirementId,

            resource:
              cleanupBags._id,

            quantityOffered: 70,

            unit: "bags",

            availableFrom:
              new Date(
                "2026-09-05T07:00:00Z"
              ),

            availableUntil:
              new Date(
                "2026-09-15T18:00:00Z"
              ),

            deliveryConditions:
              "Green Future NGO is responsible for collecting the materials from the partner warehouse.",
          },
        ],

        status:
          OFFER_STATUSES.ACCEPTED,

        organizationNotes:
          "Lebanon Equipment Support can provide 70 cleanup bags for the campaign.",

        review: {
          reviewedBy:
            rana._id,

          notes:
            "Offer accepted because it satisfies part of the verified cleanup bag requirement.",

          reviewedAt:
            new Date(
              "2026-08-11T09:00:00Z"
            ),
        },
      });

    /*
     * Second pending offer.
     */

    const medicalContributionOffer =
      await ContributionOffer.create({
        initiative:
          coastalCleanupInitiative._id,

        partnerOrganization:
          medicalSuppliesId,

        submittedBy:
          dalia._id,

        items: [
          {
            resourceRequirementId:
              medicalRequirementId,

            resource:
              firstAidKits._id,

            quantityOffered: 10,

            unit: "kits",

            availableFrom:
              new Date(
                "2026-09-05T07:00:00Z"
              ),

            availableUntil:
              new Date(
                "2026-09-15T18:00:00Z"
              ),

            deliveryConditions:
              "Medical kits must be returned if unused and unopened.",
          },
        ],

        status:
          OFFER_STATUSES.SUBMITTED,

        organizationNotes:
          "First aid kits are available for the full cleanup period.",
      });

    console.log(
      "2 contribution offers created."
    );

    /*
     * ========================================================
     * Resource Reservation
     * ========================================================
     */

    const reservation =
      await ResourceReservation.create({
        resource:
          cleanupBags._id,

        initiative:
          coastalCleanupInitiative._id,

        contributionOffer:
          contributionOffer._id,

        resourceRequirementId:
          bagsRequirementId,

        quantity: 70,

        unit: "bags",

        reservedFrom:
          new Date(
            "2026-09-05T07:00:00Z"
          ),

        reservedUntil:
          new Date(
            "2026-09-15T18:00:00Z"
          ),

        status: "active",

        reservedBy:
          rana._id,
      });

    console.log(
      "Resource reservation created."
    );

    /*
     * ========================================================
     * Volunteer Application
     * ========================================================
     */

    const volunteerApplication =
      await VolunteerApplication.create({
        initiative:
          coastalCleanupInitiative._id,

        taskId:
          prepareTaskId,

        volunteer:
          omar._id,

        status:
          APPLICATION_STATUSES.ACCEPTED,

        applicationMessage:
          "I would like to support the cleanup campaign and can assist with volunteer coordination and first aid.",

        eligibilitySnapshot: {
          matchedSkills: [
            "community outreach",
            "event support",
          ],

          missingSkills: [],

          serviceAreaMatched: true,

          taskUnlockedAtApplication: true,
        },

        reviewedBy:
          samer._id,

        reviewedAt:
          new Date(
            "2026-08-11T10:00:00Z"
          ),

        reviewNotes:
          "Volunteer matches the task requirements and service area.",
      });

    /*
     * Pending volunteer example.
     */

    await VolunteerApplication.create({
      initiative:
        coastalCleanupInitiative._id,

      taskId:
        reportTaskId,

      volunteer:
        sara._id,

      status:
        APPLICATION_STATUSES.PENDING,

      applicationMessage:
        "I can help document the event through photography and environmental awareness content.",

      eligibilitySnapshot: {
        matchedSkills: [
          "photography",
          "public awareness",
        ],

        missingSkills: [],

        serviceAreaMatched: true,

        taskUnlockedAtApplication: false,
      },
    });

    console.log(
      "2 volunteer applications created."
    );

    /*
     * ========================================================
     * Execution Events
     * ========================================================
     */

    await ExecutionEvent.create([
      {
        initiative:
          coastalCleanupInitiative._id,

        eventType:
          "initiative_approved",

        actor:
          ahmad._id,

        organization:
          tripoliMunicipalityId,

        description:
          "Tripoli Municipality approved the coastal cleanup initiative.",

        metadata: {
          approvalDecision:
            "approved",
        },

        occurredAt:
          new Date(
            "2026-08-10T09:00:00Z"
          ),
      },

      {
        initiative:
          coastalCleanupInitiative._id,

        eventType:
          "resource_reserved",

        actor:
          rana._id,

        organization:
          greenFutureId,

        resource:
          cleanupBags._id,

        description:
          "70 heavy duty cleanup bags were reserved for the initiative.",

        metadata: {
          quantity: 70,

          unit: "bags",

          resourceRequirementId:
            bagsRequirementId,

          reservationId:
            reservation._id,
        },

        occurredAt:
          new Date(
            "2026-08-11T09:15:00Z"
          ),
      },

      {
        initiative:
          coastalCleanupInitiative._id,

        eventType:
          "volunteer_assigned",

        actor:
          samer._id,

        organization:
          greenFutureId,

        taskId:
          prepareTaskId,

        description:
          "Omar Saleh was accepted as a volunteer for the preparation task.",

        metadata: {
          volunteer:
            omar._id,

          volunteerApplicationId:
            volunteerApplication._id,
        },

        occurredAt:
          new Date(
            "2026-08-11T10:05:00Z"
          ),
      },

      {
        initiative:
          coastalCleanupInitiative._id,

        eventType:
          "readiness_changed",

        actor:
          rana._id,

        organization:
          greenFutureId,

        description:
          "Initiative readiness changed to partially resourced after the cleanup bag reservation.",

        metadata: {
          previousStatus:
            READINESS_STATUSES.BLOCKED,

          newStatus:
            READINESS_STATUSES
              .PARTIALLY_RESOURCED,
        },

        occurredAt:
          new Date(
            "2026-08-11T10:10:00Z"
          ),
      },
    ]);

    console.log(
      "4 execution events created."
    );

    /*
     * ========================================================
     * Notifications
     * ========================================================
     */

    await Notification.create([
      {
        recipient:
          rana._id,

        type:
          "initiative_decision",

        title:
          "Initiative Approved",

        message:
          "Tripoli Municipality approved the Tripoli Coastal Cleanup Campaign.",

        relatedEntity: {
          entityType:
            "Initiative",

          entityId:
            coastalCleanupInitiative._id,
        },

        actionUrl:
          `/initiatives/${coastalCleanupInitiative._id}`,

        deliveredAt:
          new Date(),
      },

      {
        recipient:
          maya._id,

        type:
          "new_contribution_offer",

        title:
          "Contribution Offer Accepted",

        message:
          "Your cleanup bag contribution offer was accepted for the Tripoli Coastal Cleanup Campaign.",

        relatedEntity: {
          entityType:
            "ContributionOffer",

          entityId:
            contributionOffer._id,
        },

        actionUrl:
          `/contribution-offers/${contributionOffer._id}`,

        deliveredAt:
          new Date(),
      },

      {
        recipient:
          omar._id,

        type:
          "volunteer_assignment",

        title:
          "Volunteer Application Accepted",

        message:
          "Your volunteer application for the coastal cleanup preparation task was accepted.",

        relatedEntity: {
          entityType:
            "VolunteerApplication",

          entityId:
            volunteerApplication._id,
        },

        actionUrl:
          `/initiatives/${coastalCleanupInitiative._id}`,

        deliveredAt:
          new Date(),
      },

      {
        recipient:
          ahmad._id,

        type:
          "issue_status_changed",

        title:
          "New Issue Awaiting Review",

        message:
          "A submitted waste accumulation issue is waiting for municipality review.",

        relatedEntity: {
          entityType:
            "Issue",

          entityId:
            wasteIssue._id,
        },

        actionUrl:
          `/issues/${wasteIssue._id}`,

        deliveredAt:
          new Date(),
      },

      {
        recipient:
          rana._id,

        type:
          "new_contribution_offer",

        title:
          "New Medical Resource Offer",

        message:
          "North Medical Supplies submitted an offer for first aid kits.",

        relatedEntity: {
          entityType:
            "ContributionOffer",

          entityId:
            medicalContributionOffer._id,
        },

        actionUrl:
          `/contribution-offers/${medicalContributionOffer._id}`,

        deliveredAt:
          new Date(),
      },
    ]);

    console.log(
      "5 notifications created."
    );

    /*
     * ========================================================
     * Summary
     * ========================================================
     */

    console.log(
      "\n===================================="
    );

    console.log(
      "Seed completed successfully."
    );

    console.log(
      "===================================="
    );

    console.log(
      "\nExisting users and organizations were NOT modified."
    );

    console.log("\nCreated:");

    console.log({
      resources: resources.length,

      issues: 4,

      initiatives: 2,

      contributionOffers: 2,

      resourceReservations: 1,

      volunteerApplications: 2,

      executionEvents: 4,

      notifications: 5,
    });

    console.log(
      "\nImportant test IDs:"
    );

    console.table([
      {
        entity:
          "Submitted Issue",

        id:
          wasteIssue._id.toString(),
      },

      {
        entity:
          "Duplicate/Supported Issue",

        id:
          duplicateWasteIssue._id.toString(),
      },

      {
        entity:
          "Resolved Issue",

        id:
          streetLightIssue._id.toString(),
      },

      {
        entity:
          "Converted Issue",

        id:
          convertedIssue._id.toString(),
      },

      {
        entity:
          "Approved Initiative",

        id:
          coastalCleanupInitiative._id.toString(),
      },

      {
        entity:
          "Draft Initiative",

        id:
          draftInitiative._id.toString(),
      },

      {
        entity:
          "Planning Phase",

        id:
          planningPhaseId.toString(),
      },

      {
        entity:
          "Preparation Task",

        id:
          prepareTaskId.toString(),
      },

      {
        entity:
          "Cleanup Bags Requirement",

        id:
          bagsRequirementId.toString(),
      },
    ]);
  } catch (error) {
    console.error(
      "\nSeed failed:"
    );

    if (
      error.name ===
      "ValidationError"
    ) {
      for (
        const validationError
        of Object.values(
          error.errors
        )
      ) {
        console.error(
          `${validationError.path}: ${validationError.message}`
        );
      }
    } else if (
      error.code === 11000
    ) {
      console.error(
        "Duplicate value:",
        error.keyValue
      );
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();

    console.log(
      "\nMongoDB connection closed."
    );
  }
};

seedDatabase();