import { asyncHandler } from "../utils/async-handler.js";

import {
  createResourceService,
  getResourcesService,
  getResourceByIdService,
  updateResourceService,
  deleteResourceService,getMatchingResourcesService
} from "../services/resource.service.js";


export const createResource =
  asyncHandler(async (req, res) => {
    const resource =
      await createResourceService({
        payload: req.body,
        authenticatedUser: req.user,
      });

    return res.status(201).json({
      success: true,
      message:
        "Resource created successfully.",
      data: {
        resource,
      },
    });
  });


export const getResources =
  asyncHandler(async (req, res) => {
    const resources =
      await getResourcesService({
        authenticatedUser:
          req.user,
        query:
          req.query,
      });

    return res.status(200).json({
      success: true,
      count: resources.length,
      data: {
        resources,
      },
    });
  });


export const getResourceById =
  asyncHandler(async (req, res) => {
    const resource =
      await getResourceByIdService({
        resourceId:
          req.params.resourceId,
        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      data: {
        resource,
      },
    });
  });


export const updateResource =
  asyncHandler(async (req, res) => {
    const resource =
      await updateResourceService({
        resourceId:
          req.params.resourceId,
        payload:
          req.body,
        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Resource updated successfully.",
      data: {
        resource,
      },
    });
  });


export const deleteResource =
  asyncHandler(async (req, res) => {
    const result =
      await deleteResourceService({
        resourceId:
          req.params.resourceId,
        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Resource deleted successfully.",
      data: result,
    });
  });
  export const getMatchingResources =
  asyncHandler(async (req, res) => {
    const matches =
      await getMatchingResourcesService({
        initiativeId:
          req.params.initiativeId,
      });

    return res.status(200).json({
      success: true,
      data: {
        matches,
      },
    });
  });