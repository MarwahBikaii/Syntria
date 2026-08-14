import { WorkItem } from "../models/work-item.model.js";
import { AppError } from "../utils/app-error.js";

export const findNearWorkItemsService = async ({
  authenticatedUser,
  maxDistanceKm = 10,
}) => {
  const userLocation =
    authenticatedUser.location;

  if (
    !userLocation?.coordinates ||
    !Array.isArray(
      userLocation.coordinates.coordinates
    ) ||
    userLocation.coordinates.coordinates.length !== 2
  ) {
    throw AppError.badRequest(
      "You must have a valid location before searching for nearby work items."
    );
  }

  const [longitude, latitude] =
    userLocation.coordinates.coordinates;

  if (
    longitude < -180 ||
    longitude > 180
  ) {
    throw AppError.badRequest(
      "User longitude is invalid."
    );
  }

  if (
    latitude < -90 ||
    latitude > 90
  ) {
    throw AppError.badRequest(
      "User latitude is invalid."
    );
  }

  const distanceKm =
    Number(maxDistanceKm);

  if (
    Number.isNaN(distanceKm) ||
    distanceKm <= 0
  ) {
    throw AppError.badRequest(
      "Distance must be a positive number."
    );
  }

  const workItems =
    await WorkItem.find({
      "location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [
              longitude,
              latitude,
            ],
          },

          $maxDistance:
            distanceKm * 1000,
        },
      },
    });

  return workItems;
};