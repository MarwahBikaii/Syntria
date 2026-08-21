import { Initiative } from "../models/initiative.model.js";
import {
 filterInitiativesService,updatePhaseService,deletePhaseService,addPhaseService,deleteInitiativeService,submitInitiativeService, updateInitiativeService,createInitiativeService,getInitiativeByIdService
,reviewInitiativeApprovalService,deleteResourceRequirementService,addTaskService,addResourceRequirementService,getResourceRequirementByIdService,updateResourceRequirementService,
} from "../services/initiative.service.js";

import {
  asyncHandler,
} from "../utils/async-handler.js";


export const createInitiative =
  asyncHandler(async (req, res) => {
    const initiative =
      await createInitiativeService({
        payload: req.body,
        authenticatedUser: req.user,
      });

    return res.status(201).json({
      success: true,
      message:
        "Initiative created successfully.",
      data: {
        initiative,
      },
    });
  });

  export const getInitiativeById =
  asyncHandler(async (req, res) => {
    const initiative =
      await getInitiativeByIdService({
        initiativeId:
          req.params.initiativeId,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      data: {
        initiative,
      },
    });
  });


    export const getInitiatives =
  asyncHandler(async (req, res) => {
    const initiative =
      await Initiative.find({});

    console.log(initiative)
    return res.status(200).json({
      success: true,
      data: {
        initiative,
      },
    });
  });

export const filterInitiatives =
  asyncHandler(async (req, res) => {
    const initiatives =
      await filterInitiativesService({
        query: req.query,
        authenticatedUser: req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Initiatives filtered successfully.",
      count: initiatives.length,
      data: {
        initiatives,
      },
    });
  });

  export const updateInitiative =
  asyncHandler(async (req, res) => {
    const initiative =
      await updateInitiativeService({
        initiativeId:
          req.params.initiativeId,

        payload:
          req.body,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Initiative updated successfully.",
      data: {
        initiative,
      },
    });
  });
  export const deleteInitiative =
  asyncHandler(async (req, res) => {
    const result =
      await deleteInitiativeService({
        initiativeId:
          req.params.initiativeId,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Initiative deleted successfully.",
      data: result,
    });
  });

  export const submitInitiative =
  asyncHandler(async (req, res) => {
    const initiative =
      await submitInitiativeService({
        initiativeId:
          req.params.initiativeId,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Initiative submitted successfully.",
      data: {
        initiative,
      },
    });
  });
  export const addPhase =
  asyncHandler(async (req, res) => {
    const phase = await addPhaseService({
      initiativeId:
        req.params.initiativeId,

      payload:
        req.body,

      authenticatedUser:
        req.user,
    });

    return res.status(201).json({
      success: true,
      message:
        "Phase added successfully.",
      data: {
        phase,
      },
    });
  });
  export const updatePhase =
  asyncHandler(async (req, res) => {
    const phase = await updatePhaseService({
      initiativeId: req.params.initiativeId,
      phaseId: req.params.phaseId,
      payload: req.body,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Phase updated successfully.",
      data: {
        phase,
      },
    });
  });

export const deletePhase =
  asyncHandler(async (req, res) => {
    const result = await deletePhaseService({
      initiativeId: req.params.initiativeId,
      phaseId: req.params.phaseId,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Phase deleted successfully.",
      data: result,
    });
  });
  export const addTask = asyncHandler(
  async (req, res) => {
    const task = await addTaskService({
      initiativeId: req.params.initiativeId,
      payload: req.body,
      authenticatedUser: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "Task added successfully.",
      data: { task },
    });
  }
);

export const getTaskById = asyncHandler(
  async (req, res) => {
    const task = await getTaskByIdService({
      initiativeId: req.params.initiativeId,
      taskId: req.params.taskId,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      data: { task },
    });
  }
);

export const updateTask = asyncHandler(
  async (req, res) => {
    const task = await updateTaskService({
      initiativeId: req.params.initiativeId,
      taskId: req.params.taskId,
      payload: req.body,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Task updated successfully.",
      data: { task },
    });
  }
);

export const deleteTask = asyncHandler(
  async (req, res) => {
    const result = await deleteTaskService({
      initiativeId: req.params.initiativeId,
      taskId: req.params.taskId,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
      data: result,
    });
  }
);
export const addResourceRequirement =
  asyncHandler(async (req, res) => {
    const requirement =
      await addResourceRequirementService({
        initiativeId: req.params.initiativeId,
        payload: req.body,
        authenticatedUser: req.user,
      });

    return res.status(201).json({
      success: true,
      message:
        "Resource requirement added successfully.",
      data: {
        requirement,
      },
    });
  });

export const getResourceRequirementById =
  asyncHandler(async (req, res) => {
    const requirement =
      await getResourceRequirementByIdService({
        initiativeId: req.params.initiativeId,
        requirementId: req.params.requirementId,
      });

    return res.status(200).json({
      success: true,
      data: {
        requirement,
      },
    });
  });

export const updateResourceRequirement =
  asyncHandler(async (req, res) => {
    const requirement =
      await updateResourceRequirementService({
        initiativeId: req.params.initiativeId,
        requirementId: req.params.requirementId,
        payload: req.body,
        authenticatedUser: req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Resource requirement updated successfully.",
      data: {
        requirement,
      },
    });
  });

export const deleteResourceRequirement =
  asyncHandler(async (req, res) => {
    const result =
      await deleteResourceRequirementService({
        initiativeId: req.params.initiativeId,
        requirementId: req.params.requirementId,
        authenticatedUser: req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Resource requirement deleted successfully.",
      data: result,
    });
  });

  export const reviewInitiativeApproval =
  asyncHandler(async (req, res) => {
    const {
      decision,
      notes,
    } = req.body;

    if (!decision) {
      throw AppError.badRequest(
        "Approval decision is required."
      );
    }

    const initiative =
      await reviewInitiativeApprovalService({
        initiativeId:
          req.params.initiativeId,
        decision,
        notes,
        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Initiative approval reviewed successfully.",
      data: {
        initiative,
      },
    });
  });