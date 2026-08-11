import {
  asyncHandler,
} from "../utils/async-handler.js";

import {
  createResourceRequestService,
  reviewResourceRequestService,
} from "../services/resource-request.service.js";

export const createResourceRequest =
  asyncHandler(async (req, res) => {
    const request =
      await createResourceRequestService({
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
        "Resource request submitted successfully.",
      data: {
        request,
      },
    });
  });

export const reviewResourceRequest =
  asyncHandler(async (req, res) => {
    const result =
      await reviewResourceRequestService({
        requestId:
          req.params.requestId,
        decision:
          req.body.decision,
        notes:
          req.body.notes,
        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        req.body.decision ===
        "accepted"
          ? "Resource request accepted and reservation created successfully."
          : "Resource request rejected successfully.",
      data: result,
    });
  });