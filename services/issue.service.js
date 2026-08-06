// import mongoose from "mongoose";

// import {
//   Initiative,
//   Issue,
//   Organization,
//   User,
// } from "../models/index.js";

// import { AppError } from "../utils/app-error.js";
// import {
//   deleteCloudinaryAssets,
//   uploadFilesToCloudinary,
// } from "./cloudinary.service.js";
// import { analyzeIssuePlaceholder } from "./ai-analysis.service.js";
// import { createNotification } from "./notification.service.js";

// const COMMUNITY_MEMBER_ROLE = "community_member";
// const MUNICIPALITY_ROLE = "municipality";

// const ensureValidObjectId = (value, fieldName) => {
//   if (!mongoose.isValidObjectId(value)) {
//     throw new AppError(
//       `${fieldName} must be a valid MongoDB ObjectId.`,
//       400
//     );
//   }
// };

// const verifyCommunityMemberCreator = async ({
//   createdBy,
//   authenticatedUser,
// }) => {
//   ensureValidObjectId(createdBy, "createdBy");

//   /*
//    * createdBy is accepted from req.body as requested,
//    * but must match the authenticated user to prevent impersonation.
//    */
//   if (createdBy.toString() !== authenticatedUser._id.toString()) {
//     throw new AppError(
//       "createdBy must match the authenticated user.",
//       403
//     );
//   }

//   const creator = await User.findById(createdBy).select(
//     "_id role accountStatus"
//   );

//   if (!creator) {
//     throw new AppError("Issue creator was not found.", 404);
//   }

//   if (creator.role !== COMMUNITY_MEMBER_ROLE) {
//     throw new AppError(
//       "Only Community Members can create issues.",
//       403
//     );
//   }

//   return creator;
// };

// const verifyMunicipality = async (municipalityId) => {
//   ensureValidObjectId(municipalityId, "municipality");

//   const municipality = await Organization.findOne({
//     _id: municipalityId,
//     type: "municipality",
//     status: "active",
//   }).select("_id name type status");

//   if (!municipality) {
//     throw new AppError(
//       "An active Municipality with this ID was not found.",
//       404
//     );
//   }

//   return municipality;
// };

// const findPossibleDuplicates = async ({
//   title,
//   description,
//   municipality,
//   coordinates,
// }) => {
//   const query = {
//     municipality,
//     status: {
//       $nin: ["rejected", "closed"],
//     },
//     $text: {
//       $search: `${title} ${description}`,
//     },
//   };

//   /*
//    * Keep the first implementation simple.
//    * Geographic duplicate matching can be added after the GeoJSON
//    * fields and 2dsphere index are confirmed in the real schema.
//    */
//   const possibleDuplicates = await Issue.find(query, {
//     score: {
//       $meta: "textScore",
//     },
//   })
//     .sort({
//       score: {
//         $meta: "textScore",
//       },
//     })
//     .limit(5)
//     .select(
//       "_id title description location status supports createdAt"
//     )
//     .lean();

//   return possibleDuplicates.map((issue) => ({
//     issue: issue._id,
//     similarityScore: 0.7,
//     reasons: [
//       "Similar issue title or description",
//       "Reported to the same Municipality",
//     ],
//     detectedAt: new Date(),
//   }));
// };

// export const createIssueService = async ({
//   payload,
//   files,
//   authenticatedUser,
// }) => {
//   const {
//     title,
//     description,
//     location,
//     municipality,
//     createdBy,
//   } = payload;

//   if (!title || !description || !location || !municipality) {
//     throw new AppError(
//       "title, description, location, and municipality are required.",
//       400
//     );
//   }

//   if (!createdBy) {
//     throw new AppError("createdBy is required.", 400);
//   }

//   await verifyCommunityMemberCreator({
//     createdBy,
//     authenticatedUser,
//   });

//   await verifyMunicipality(municipality);

//   if (!files?.length) {
//     throw new AppError(
//       "At least one supporting image or video is required.",
//       400
//     );
//   }

//   let uploadedMedia = [];

//   try {
//     uploadedMedia = await uploadFilesToCloudinary(
//       files,
//       authenticatedUser._id
//     );

//     const aiAnalysis = await analyzeIssuePlaceholder({
//       title,
//       description,
//     });

//     const duplicateCandidates =
//       await findPossibleDuplicates({
//         title,
//         description,
//         municipality,
//         coordinates: location?.coordinates,
//       });

//     const issue = await Issue.create({
//       title,
//       description,
//       location,
//       municipality,
//       createdBy,
//       media: uploadedMedia,
//       category: aiAnalysis.category,
//       priority: aiAnalysis.priority,
//       aiAnalysis,
//       duplicateCandidates,
//       duplicateDecision:
//         duplicateCandidates.length > 0
//           ? "not_checked"
//           : "no_duplicate",
//       status:
//         duplicateCandidates.length > 0
//           ? "draft"
//           : "submitted",
//       submittedAt:
//         duplicateCandidates.length > 0
//           ? null
//           : new Date(),
//       statusHistory:
//         duplicateCandidates.length > 0
//           ? []
//           : [
//               {
//                 fromStatus: "draft",
//                 toStatus: "submitted",
//                 changedBy: authenticatedUser._id,
//                 reason: "Issue submitted by Community Member.",
//                 changedAt: new Date(),
//               },
//             ],
//     });

//     return issue;
//   } catch (error) {
//     await deleteCloudinaryAssets(uploadedMedia);
//     throw error;
//   }
// };

// export const supportExistingIssueService = async ({
//   currentIssueId,
//   existingIssueId,
//   authenticatedUser,
//   comment,
// }) => {
//   ensureValidObjectId(currentIssueId, "currentIssueId");
//   ensureValidObjectId(existingIssueId, "existingIssueId");

//   if (currentIssueId === existingIssueId) {
//     throw new AppError(
//       "An issue cannot support itself.",
//       400
//     );
//   }

//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();

//     const draftIssue = await Issue.findOne({
//       _id: currentIssueId,
//       createdBy: authenticatedUser._id,
//       status: "draft",
//     }).session(session);

//     if (!draftIssue) {
//       throw new AppError(
//         "The draft issue was not found or cannot be modified.",
//         404
//       );
//     }

//     const duplicateWasSuggested =
//       draftIssue.duplicateCandidates.some(
//         (candidate) =>
//           candidate.issue.toString() === existingIssueId
//       );

//     if (!duplicateWasSuggested) {
//       throw new AppError(
//         "The selected issue was not identified as a duplicate candidate.",
//         400
//       );
//     }

//     const existingIssue = await Issue.findOne({
//       _id: existingIssueId,
//       municipality: draftIssue.municipality,
//       status: {
//         $nin: ["rejected", "closed"],
//       },
//     }).session(session);

//     if (!existingIssue) {
//       throw new AppError(
//         "The existing issue is unavailable for support.",
//         404
//       );
//     }

//     const alreadySupported = existingIssue.supports.some(
//       (support) =>
//         support.user.toString() ===
//         authenticatedUser._id.toString()
//     );

//     if (!alreadySupported) {
//       existingIssue.supports.push({
//         user: authenticatedUser._id,
//         comment,
//         supportedAt: new Date(),
//       });

//       await existingIssue.save({ session });
//     }

//     draftIssue.duplicateDecision = "supported_existing";
//     draftIssue.supportedExistingIssue = existingIssue._id;

//     await draftIssue.save({ session });

//     /*
//      * The user requested permanent deletion.
//      * Media is deleted after the database transaction commits.
//      */
//     const discardedMedia = [...draftIssue.media];

//     await Issue.deleteOne(
//       {
//         _id: draftIssue._id,
//       },
//       { session }
//     );

//     await session.commitTransaction();

//     await deleteCloudinaryAssets(discardedMedia);

//     return existingIssue;
//   } catch (error) {
//     await session.abortTransaction();
//     throw error;
//   } finally {
//     await session.endSession();
//   }
// };

// export const getIssuesService = async ({
//   authenticatedUser,
//   query,
// }) => {
//   const {
//     page = "1",
//     limit = "10",
//     status,
//     priority,
//     municipality,
//     createdBy,
//     search,
//   } = query;

//   const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
//   const limitNumber = Math.min(
//     Math.max(Number.parseInt(limit, 10) || 10, 1),
//     100
//   );

//   const filter = {};

//   if (status) {
//     filter.status = status;
//   }

//   if (priority) {
//     filter.priority = priority;
//   }

//   if (municipality) {
//     ensureValidObjectId(municipality, "municipality");
//     filter.municipality = municipality;
//   }

//   if (createdBy) {
//     ensureValidObjectId(createdBy, "createdBy");
//     filter.createdBy = createdBy;
//   }

//   if (search) {
//     filter.$text = {
//       $search: search,
//     };
//   }

//   /*
//    * Community Members only see their own submitted reports,
//    * unless a later public issue policy is added.
//    */
//   if (authenticatedUser.role === COMMUNITY_MEMBER_ROLE) {
//     filter.createdBy = authenticatedUser._id;
//   }

//   /*
//    * Municipality users only see issues routed to their organization.
//    */
//   if (authenticatedUser.role === MUNICIPALITY_ROLE) {
//     if (!authenticatedUser.organization) {
//       throw new AppError(
//         "The Municipality user is not linked to an organization.",
//         403
//       );
//     }

//     filter.municipality = authenticatedUser.organization;
//   }

//   const skip = (pageNumber - 1) * limitNumber;

//   const [issues, total] = await Promise.all([
//     Issue.find(filter)
//       .populate("createdBy", "firstName lastName email")
//       .populate("municipality", "name type")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNumber),
//     Issue.countDocuments(filter),
//   ]);

//   return {
//     issues,
//     pagination: {
//       page: pageNumber,
//       limit: limitNumber,
//       total,
//       pages: Math.ceil(total / limitNumber),
//     },
//   };
// };

// export const getIssueByIdService = async ({
//   issueId,
//   authenticatedUser,
// }) => {
//   ensureValidObjectId(issueId, "issueId");

//   const issue = await Issue.findById(issueId)
//     .populate("createdBy", "firstName lastName email")
//     .populate("municipality", "name type")
//     .populate(
//       "supports.user",
//       "firstName lastName email"
//     )
//     .populate(
//       "duplicateCandidates.issue",
//       "title description status location createdAt"
//     )
//     .populate("convertedInitiative");

//   if (!issue) {
//     throw new AppError("Issue not found.", 404);
//   }

//   const isOwner =
//     issue.createdBy._id.toString() ===
//     authenticatedUser._id.toString();

//   const isAssignedMunicipality =
//     authenticatedUser.role === MUNICIPALITY_ROLE &&
//     authenticatedUser.organization &&
//     issue.municipality._id.toString() ===
//       authenticatedUser.organization.toString();

//   if (!isOwner && !isAssignedMunicipality) {
//     throw new AppError(
//       "You are not authorized to view this issue.",
//       403
//     );
//   }

//   return issue;
// };

// export const reviewIssueService = async ({
//   issueId,
//   decision,
//   notes,
//   authenticatedUser,
// }) => {
//   ensureValidObjectId(issueId, "issueId");

//   const allowedDecisions = new Set([
//     "resolve_internally",
//     "convert_to_initiative",
//     "reject",
//   ]);

//   if (!allowedDecisions.has(decision)) {
//     throw new AppError(
//       "Invalid Municipality review decision.",
//       400
//     );
//   }

//   if (!authenticatedUser.organization) {
//     throw new AppError(
//       "The Municipality user is not linked to an organization.",
//       403
//     );
//   }

//   if (decision === "convert_to_initiative") {
//     throw new AppError(
//       "Use the dedicated issue conversion endpoint.",
//       400
//     );
//   }

//   const issue = await Issue.findOne({
//     _id: issueId,
//     municipality: authenticatedUser.organization,
//     status: {
//       $in: ["submitted", "under_review"],
//     },
//   });

//   if (!issue) {
//     throw new AppError(
//       "Issue not found or unavailable for review.",
//       404
//     );
//   }

//   const previousStatus = issue.status;

//   const nextStatus =
//     decision === "resolve_internally"
//       ? "resolved_internally"
//       : "rejected";

//   issue.status = nextStatus;

//   issue.municipalityReview = {
//     decision,
//     reviewedBy: authenticatedUser._id,
//     notes,
//     reviewedAt: new Date(),
//   };

//   if (decision === "resolve_internally") {
//     issue.resolvedInternallyAt = new Date();
//   }

//   issue.statusHistory.push({
//     fromStatus: previousStatus,
//     toStatus: nextStatus,
//     changedBy: authenticatedUser._id,
//     reason: notes || `Municipality decision: ${decision}`,
//     changedAt: new Date(),
//   });

//   await issue.save();

//   await createNotification({
//     recipient: issue.createdBy,
//     type: "issue_status_changed",
//     title: "Issue status updated",
//     message: `Your issue "${issue.title}" is now ${nextStatus.replaceAll("_", " ")}.`,
//     entityType: "Issue",
//     entityId: issue._id,
//     actionUrl: `/issues/${issue._id}`,
//   });

//   return issue;
// };

// export const convertIssueToInitiativeService = async ({
//   issueId,
//   payload,
//   authenticatedUser,
// }) => {
//   ensureValidObjectId(issueId, "issueId");

//   if (!authenticatedUser.organization) {
//     throw new AppError(
//       "The Municipality user is not linked to an organization.",
//       403
//     );
//   }

//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();

//     const issue = await Issue.findOne({
//       _id: issueId,
//       municipality: authenticatedUser.organization,
//       status: {
//         $in: ["submitted", "under_review"],
//       },
//       convertedInitiative: null,
//     }).session(session);

//     if (!issue) {
//       throw new AppError(
//         "Issue not found, already converted, or unavailable for conversion.",
//         404
//       );
//     }

//     const {
//       leadOrganization,
//       expectedOutcome,
//       executionPeriod,
//       phases = [],
//       tasks = [],
//       resourceRequirements = [],
//     } = payload;

//     if (
//       !leadOrganization ||
//       !expectedOutcome ||
//       !executionPeriod?.plannedStartAt ||
//       !executionPeriod?.plannedEndAt
//     ) {
//       throw new AppError(
//         "leadOrganization, expectedOutcome, plannedStartAt, and plannedEndAt are required.",
//         400
//       );
//     }

//     ensureValidObjectId(
//       leadOrganization,
//       "leadOrganization"
//     );

//     const leadOrganizationRecord =
//       await Organization.findOne({
//         _id: leadOrganization,
//         type: "community_organization",
//         status: "active",
//       }).session(session);

//     if (!leadOrganizationRecord) {
//       throw new AppError(
//         "The selected Community Organization was not found or is inactive.",
//         404
//       );
//     }

//     const [initiative] = await Initiative.create(
//       [
//         {
//           title: issue.title,
//           description: issue.description,
//           location: issue.location,
//           media: issue.media,
//           municipality: issue.municipality,
//           createdBy: authenticatedUser._id,
//           sourceIssue: issue._id,
//           leadOrganization,
//           expectedOutcome,
//           executionPeriod,
//           phases,
//           tasks,
//           resourceRequirements,
//           status: "draft",
//           approval: {
//             decision: "approved",
//             reviewedBy: authenticatedUser._id,
//             notes:
//               payload.approvalNotes ||
//               "Created from a Municipality-approved issue.",
//             reviewedAt: new Date(),
//             revisionNumber: 0,
//           },
//           readiness: {
//             status: "blocked",
//             municipalityApproved: true,
//             resourcesSatisfied: false,
//             dependenciesSatisfied: false,
//             blockingReasons: [
//               "Resource and dependency readiness must be calculated.",
//             ],
//             calculatedAt: new Date(),
//           },
//           statusHistory: [
//             {
//               fromStatus: null,
//               toStatus: "draft",
//               changedBy: authenticatedUser._id,
//               reason: "Initiative created from community issue.",
//               changedAt: new Date(),
//             },
//           ],
//         },
//       ],
//       { session }
//     );

//     issue.status = "converted_to_initiative";
//     issue.convertedInitiative = initiative._id;
//     issue.municipalityReview = {
//       decision: "convert_to_initiative",
//       reviewedBy: authenticatedUser._id,
//       notes:
//         payload.reviewNotes ||
//         "Issue converted into a community initiative.",
//       reviewedAt: new Date(),
//     };

//     issue.statusHistory.push({
//       fromStatus: issue.status,
//       toStatus: "converted_to_initiative",
//       changedBy: authenticatedUser._id,
//       reason: "Municipality converted issue into initiative.",
//       changedAt: new Date(),
//     });

//     await issue.save({ session });

//     await createNotification({
//       recipient: issue.createdBy,
//       type: "issue_status_changed",
//       title: "Issue converted into an initiative",
//       message: `Your issue "${issue.title}" has been converted into a community initiative.`,
//       entityType: "Initiative",
//       entityId: initiative._id,
//       actionUrl: `/initiatives/${initiative._id}`,
//       session,
//     });

//     await session.commitTransaction();

//     return {
//       issue,
//       initiative,
//     };
//   } catch (error) {
//     await session.abortTransaction();
//     throw error;
//   } finally {
//     await session.endSession();
//   }
// };

// export const deleteIssueService = async ({
//   issueId,
//   authenticatedUser,
// }) => {
//   ensureValidObjectId(issueId, "issueId");

//   const issue = await Issue.findById(issueId);

//   if (!issue) {
//     throw new AppError("Issue not found.", 404);
//   }

//   const isCreator =
//     issue.createdBy.toString() ===
//     authenticatedUser._id.toString();

//   const isAssignedMunicipality =
//     authenticatedUser.role === MUNICIPALITY_ROLE &&
//     authenticatedUser.organization &&
//     issue.municipality.toString() ===
//       authenticatedUser.organization.toString();

//   if (!isCreator && !isAssignedMunicipality) {
//     throw new AppError(
//       "You are not authorized to delete this issue.",
//       403
//     );
//   }

//   if (
//     isCreator &&
//     !["draft", "submitted"].includes(issue.status)
//   ) {
//     throw new AppError(
//       "Community Members can only delete draft or submitted issues.",
//       409
//     );
//   }

//   if (issue.convertedInitiative) {
//     throw new AppError(
//       "An issue that has been converted into an initiative cannot be deleted.",
//       409
//     );
//   }

//   const mediaToDelete = [...issue.media];

//   await issue.deleteOne();

//   await deleteCloudinaryAssets(mediaToDelete);

//   return {
//     deletedIssueId: issue._id,
//   };
// };