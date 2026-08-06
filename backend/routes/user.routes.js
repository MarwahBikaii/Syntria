import express from "express";

import {
  activateVolunteerProfile,
  deactivateVolunteerProfile,updateVolunteerProfile,
  deleteMyAccount,
  getProfile,
  getUserById,
  getUsers,updatePassword,
  updateProfile,
} from "../controllers/user.controller.js";

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

/*
 * All routes below require authentication.
 */
router.use(authenticate);

/*
 * Current authenticated user.
 *
 * GET    /api/users/me
 * PATCH  /api/users/me
 * DELETE /api/users/me
 */
router
  .route("/me")
  .get(getProfile)
  .patch(updateProfile)
  .delete(deleteMyAccount)
  
  
  router.patch("/me/password", updatePassword)

/*
 * Organization profile.
 *
 * PATCH /api/users/me/organization-profile
 */
// router.patch(
//   "/me/organization-profile",
//   authorizeRoles(
//     USER_ROLES.MUNICIPALITY,
//     USER_ROLES.COMMUNITY_ORGANIZATION,
//     USER_ROLES.RESOURCE_PARTNER,
//   ),
//   updateOrganizationProfile,
// );

/*
 * Volunteer profile.
 *
 * PUT   /api/users/me/volunteer-profile
 * PATCH /api/users/me/volunteer-profile/deactivate
 */
router.put(
  "/me/volunteer-profile",
  authorizeRoles(USER_ROLES.COMMUNITY_MEMBER),
  activateVolunteerProfile,
);

router.patch(
  "/me/volunteer-profile/deactivate",
  authorizeRoles(USER_ROLES.COMMUNITY_MEMBER),
  deactivateVolunteerProfile,
);
router.patch(
  "/me/volunteer-profile",
  authorizeRoles(
    USER_ROLES.COMMUNITY_MEMBER
  ),
  updateVolunteerProfile
);
/*
 * Authorized organization users can browse relevant users,
 * organizations, partners, and active volunteers.
 *
 * GET /api/users
 */
router.get(
  "/",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION,
    USER_ROLES.RESOURCE_PARTNER,
  ),
  getUsers,
);

/*
 * Keep the parameterized route last so that values such as
 * "me" are not interpreted as MongoDB user IDs.
 *
 * GET /api/users/:userId
 */
router.get("/:userId", getUserById);

export default router;