import { asyncHandler } from "../utils/async-handler.js";

import {
  createContributionOfferService,
  reviewContributionOfferService,
  withdrawContributionOfferService,
} from "../services/contribution-offer.service.js";


export const createContributionOffer =
  asyncHandler(async (req, res) => {
    const offer =
      await createContributionOfferService({
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
        "Contribution offer submitted successfully.",
      data: {
        offer,
      },
    });
  });


export const reviewContributionOffer =
  asyncHandler(async (req, res) => {
    const {
      decision,
      notes,
    } = req.body;

    const result =
      await reviewContributionOfferService({
        offerId:
          req.params.offerId,

        decision,

        notes,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,

      message:
        decision === "accepted"
          ? "Contribution offer accepted and resources reserved successfully."
          : "Contribution offer rejected successfully.",

      data: result,
    });
  });


export const withdrawContributionOffer =
  asyncHandler(async (req, res) => {
    const offer =
      await withdrawContributionOfferService({
        offerId:
          req.params.offerId,

        reason:
          req.body.reason,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Contribution offer withdrawn successfully.",
      data: {
        offer,
      },
    });
  });