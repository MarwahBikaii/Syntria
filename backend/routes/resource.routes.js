import express from "express";

import {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
  getMatchingResources
} from "../controllers/resources.controller.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authorizeRoles,
} from "../middleware/authorize.middleware.js";

import {
  USER_ROLES,
} from "../constants/enums.js";


const router = express.Router();

router.use(authenticate);

router
  .route("/")
  .get(getResources)
  .post(
    authorizeRoles(
      USER_ROLES.RESOURCE_PARTNER
    ),
    createResource
  );

  router.route("/requirement/:resourceRequirementId/matching-resources")
  .get(
     authorizeRoles(
      USER_ROLES.MUNICIPALITY,
      USER_ROLES.COMMUNITY_ORGANIZATION
     ),getMatchingResources
  )
router
  .route("/:resourceId")
  .get(getResourceById)
  .patch(
    authorizeRoles(
      USER_ROLES.RESOURCE_PARTNER
    ),
    updateResource
  )
  .delete(
    authorizeRoles(
      USER_ROLES.RESOURCE_PARTNER
    ),
    deleteResource
  );

export default router;