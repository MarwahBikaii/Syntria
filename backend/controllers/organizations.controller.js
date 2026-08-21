import mongoose from "mongoose";

import  Organization  from "../models/organizationModel.js";
import { asyncHandler } from "../utils/async-handler.js";



export const getOrganizations = asyncHandler(
  async (req, res) => {
    const {
      organizationType,
      status,
      verificationStatus,
    } = req.query;

    const filter = {};

    /*
     * Add filters only if supplied.
     */
    if (organizationType) {
      filter.organizationType =
        organizationType;
    }

    if (status) {
      filter.status = status;
    }

    if (verificationStatus) {
      filter.verificationStatus =
        verificationStatus;
    }

    const organizations =
      await Organization.find(filter)
        .sort({
          name: 1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: organizations.length,
      data: {
        organizations,
      },
    });
  })