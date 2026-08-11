import express from "express";

import {
  createContributionOffer,
  reviewContributionOffer,
  withdrawContributionOffer,
} from "../controllers/contribution-offer.controllers.js";

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


/*
 * Resource Partner submits an offer.
 */
router.post(
  "/initiatives/:initiativeId",
  authorizeRoles(
    USER_ROLES.RESOURCE_PARTNER
  ),
  createContributionOffer
);


/*
 * Lead Community Organization reviews it.
 */
router.patch(
  "/:offerId/review",
  authorizeRoles(
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  reviewContributionOffer
);


/*
 * Resource Partner withdraws its own offer.
 */
router.patch(
  "/:offerId/withdraw",
  authorizeRoles(
    USER_ROLES.RESOURCE_PARTNER
  ),
  withdrawContributionOffer
);

export default router;