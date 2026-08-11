import express from "express";

import {
  getResourceRequirementById,addResourceRequirement,deleteResourceRequirement,updateResourceRequirement,getTaskById,addTask,deleteTask,updateTask,updatePhase,deletePhase,addPhase,submitInitiative,deleteInitiative,createInitiative,getInitiativeById,updateInitiative
} from "../controllers/initiative.controller.js";

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

router.post(
  "/",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  createInitiative
);

router.get(
  "/:initiativeId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  getInitiativeById
);

router.patch(
  "/:initiativeId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  updateInitiative
);
router.delete(
  "/:initiativeId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  deleteInitiative
);
router.patch(
  "/:initiativeId/submit",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  submitInitiative
);
router.post(
  "/:initiativeId/phases",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  addPhase
);
router.patch(
  "/:initiativeId/phases/:phaseId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  updatePhase
);

router.delete(
  "/:initiativeId/phases/:phaseId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  deletePhase
);
router.post(
  "/:initiativeId/tasks",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  addTask
);

router.get(
  "/:initiativeId/tasks/:taskId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  getTaskById
);

router.patch(
  "/:initiativeId/tasks/:taskId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  updateTask
);

router.delete(
  "/:initiativeId/tasks/:taskId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  deleteTask
);
router.post(
  "/:initiativeId/resource-requirements",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  addResourceRequirement
);

router.get(
  "/:initiativeId/resource-requirements/:requirementId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  getResourceRequirementById
);

router.patch(
  "/:initiativeId/resource-requirements/:requirementId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  updateResourceRequirement
);

router.delete(
  "/:initiativeId/resource-requirements/:requirementId",
  authorizeRoles(
    USER_ROLES.MUNICIPALITY,
    USER_ROLES.COMMUNITY_ORGANIZATION
  ),
  deleteResourceRequirement
);
export default router;