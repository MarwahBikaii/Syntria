// import express from "express";

// import {
//   convertIssueToInitiative,
//   createIssue,
//   deleteIssue,
//   getIssueById,
//   getIssues,
//   reviewIssue,
//   supportExistingIssue,
// } from "../controllers/issue.controller.js";

// import { USER_ROLES } from "../constants/enums.js";

// import { authenticate } from "../middleware/auth.middleware.js";
// import { authorizeRoles } from "../middleware/authorize.middleware.js";
// import { parseIssueFields } from "../middleware/parse-issue-fields.middleware.js";
// import { uploadIssueMedia } from "../middleware/upload.middleware.js";
// import {requireOrganization} from "../middleware/organization-access.middleware.js"
// const router = express.Router();

// router.use(authenticate);

// router
//   .route("/")
//   .get(
//     authorizeRoles(
//       USER_ROLES.COMMUNITY_MEMBER,
//       USER_ROLES.MUNICIPALITY,
//     ),
//     getIssues,
//   )
//   .post(
//     authorizeRoles(USER_ROLES.COMMUNITY_MEMBER),
//     uploadIssueMedia,
//     parseIssueFields,
//     createIssue,
//   );

// router.post(
//   "/:issueId/support-existing",
//   authorizeRoles(USER_ROLES.COMMUNITY_MEMBER),
//   supportExistingIssue,
// );

// router.patch(
//   "/:issueId/review",
//   authorizeRoles(USER_ROLES.MUNICIPALITY),
//   requireOrganization,
//   reviewIssue,
// );

// router.post(
//   "/:issueId/convert-to-initiative",
//   authorizeRoles(USER_ROLES.MUNICIPALITY),
//   convertIssueToInitiative,
// );

// router
//   .route("/:issueId")
//   .get(
//     authorizeRoles(
//       USER_ROLES.COMMUNITY_MEMBER,
//       USER_ROLES.MUNICIPALITY,
//     ),
//     getIssueById,
//   )
//   .delete(
//     authorizeRoles(
//       USER_ROLES.COMMUNITY_MEMBER,
//       USER_ROLES.MUNICIPALITY,
//     ),
//     deleteIssue,
//   );

// export default router;