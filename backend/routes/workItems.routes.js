import express from "express";

import {getNearbyWorkItems
} from "../controllers/workItems.controller.js";

import {
  USER_ROLES,
} from "../constants/enums.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authorizeRoles,
} from "../middleware/authorize.middleware.js";


const router = express.Router();

router.use(authenticate);



router.get(
  "/near",
  authorizeRoles(
   USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION,
    USER_ROLES.RESOURCE_PARTNER,
    USER_ROLES.COMMUNITY_MEMBER
  ),

  getNearbyWorkItems
);
export default router;