// import { asyncHandler } from "../utils/async-handler.js";
// import { AppError } from "../utils/app-error.js";

// import {
//   convertIssueToInitiativeService,
//   createIssueService,
//   deleteIssueService,
//   getIssueByIdService,
//   getIssuesService,
//   reviewIssueService,
//   supportExistingIssueService,
// } from "../services/issue.service.js";

// export const createIssue = asyncHandler(
//   async (req, res) => {
//     const issue = await createIssueService({
//       payload: req.body,
//       files: req.files ?? [],
//       authenticatedUser: req.user,
//     });

//     const requiresDuplicateDecision =
//       Array.isArray(issue.duplicateCandidates) &&
//       issue.duplicateCandidates.length > 0;

//     return res.status(201).json({
//       success: true,
//       message: requiresDuplicateDecision
//         ? "Possible duplicate issues were found. Select an existing issue to support."
//         : "Issue submitted successfully.",
//       requiresDuplicateDecision,
//       data: issue,
//     });
//   },
// );

// export const supportExistingIssue = asyncHandler(
//   async (req, res) => {
//     const { existingIssueId, comment } = req.body;

//     if (!existingIssueId) {
//       throw new AppError(
//         "existingIssueId is required.",
//         400,
//       );
//     }

//     const issue = await supportExistingIssueService({
//       currentIssueId: req.params.issueId,
//       existingIssueId,
//       comment,
//       authenticatedUser: req.user,
//     });

//     return res.status(200).json({
//       success: true,
//       message:
//         "The existing issue was supported successfully. The duplicate draft was removed.",
//       data: issue,
//     });
//   },
// );

// export const getIssues = asyncHandler(
//   async (req, res) => {
//     const result = await getIssuesService({
//       authenticatedUser: req.user,
//       query: req.query,
//     });

//     return res.status(200).json({
//       success: true,
//       count: result.issues.length,
//       pagination: result.pagination,
//       data: result.issues,
//     });
//   },
// );

// export const getIssueById = asyncHandler(
//   async (req, res) => {
//     const issue = await getIssueByIdService({
//       issueId: req.params.issueId,
//       authenticatedUser: req.user,
//     });

//     return res.status(200).json({
//       success: true,
//       data: issue,
//     });
//   },
// );

// export const reviewIssue = asyncHandler(
//   async (req, res) => {
//     const { decision, notes } = req.body;

//     if (!decision) {
//       throw new AppError(
//         "Municipality review decision is required.",
//         400,
//       );
//     }

//     const issue = await reviewIssueService({
//       issueId: req.params.issueId,
//       decision,
//       notes,
//       authenticatedUser: req.user,
//     });

//     return res.status(200).json({
//       success: true,
//       message:
//         "Municipality review recorded successfully.",
//       data: issue,
//     });
//   },
// );

// export const convertIssueToInitiative = asyncHandler(
//   async (req, res) => {
//     const result =
//       await convertIssueToInitiativeService({
//         issueId: req.params.issueId,
//         payload: req.body,
//         authenticatedUser: req.user,
//       });

//     return res.status(201).json({
//       success: true,
//       message:
//         "Issue converted into an initiative successfully.",
//       data: result,
//     });
//   },
// );

// export const deleteIssue = asyncHandler(
//   async (req, res) => {
//     const result = await deleteIssueService({
//       issueId: req.params.issueId,
//       authenticatedUser: req.user,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Issue permanently deleted.",
//       data: result,
//     });
//   },
// );