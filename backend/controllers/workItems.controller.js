import {
  findNearWorkItemsService
} from "../services/workItemService.js";

export const getNearbyWorkItems = async (
  req,
  res,
  next
) => {
  try {
    const workItems =
      await findNearWorkItemsService({
        authenticatedUser: req.user,
        maxDistanceKm:
          req.query.distance ?? 10,
      });

    return res.status(200).json({
      success: true,
      message:
        "Nearby work items retrieved successfully.",
      count: workItems.length,
      data: {
        workItems,
      },
    });
  } catch (error) {
    next(error);
  }
};