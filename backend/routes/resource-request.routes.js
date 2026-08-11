import express from "express";

import {
  reviewResourceRequest,
} from "../controllers/resource-request.controller.js";

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

router.patch(
  "/:requestId/review",
  authorizeRoles(
    USER_ROLES.RESOURCE_PARTNER
  ),
  reviewResourceRequest
);

export default router;