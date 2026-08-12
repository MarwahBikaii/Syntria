import express from "express";

import {
  convertIssueToInitiative,reviewIssue,submitIssue,removeIssueSupport,createIssue,getIssues,updateIssue,removeIssue,getIssueById,supportExistingIssue
} from "../controllers/issue.controller.js";

import {
  USER_ROLES,
} from "../constants/enums.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authorizeRoles,
} from "../middleware/authorize.middleware.js";

import {
  uploadIssueMedia,
} from "../middleware/upload.middleware.js";

import {
  parseIssueFields,
} from "../middleware/parse-issue-fields.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  uploadIssueMedia,
  parseIssueFields,
  createIssue
);



router.get(
  "/myReports",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),

  getIssues
);

router.get(
  "/:issueId",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),

  getIssueById
);


router.patch(
  "/:issueId",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  parseIssueFields,
  updateIssue
);
router.patch(
  "/:issueId/submit",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),

  submitIssue
);

router.patch(
  "/:issueId/review",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY
  ),
  reviewIssue
);


router.delete(
  "/:issueId",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
 removeIssue
);

router.post(
  "/:issueId/support",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  supportExistingIssue
);
router.delete(
  "/:issueId/support",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  removeIssueSupport
);

export default router;
router.post(
  "/:issueId/convert-to-initiative",

  authorizeRoles(
    USER_ROLES.MUNICIPALITY
  ),

  convertIssueToInitiative
);