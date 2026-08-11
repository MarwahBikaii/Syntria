import mongoose from "mongoose";

import { Issue } from "../models/issue.model.js";
import Organization from "../models/organizationModel.js";

import {
  ISSUE_STATUSES,
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
} from "../constants/enums.js";

import { AppError } from "../utils/app-error.js";

import { asyncHandler } from "../utils/async-handler.js";

import {
  createIssueService,updateIssueService,deleteIssueService,
  deleteInitiativeService,submitIssueService,removeSupportIssueService,getIssueByIdService,supportExistingIssueService
} from "../services/issue.service.js";

export const createIssue = asyncHandler(
  async (req, res) => {
    const issue = await createIssueService({
      payload: req.body,
      files: req.files ?? [],
      authenticatedUser: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "Issue created successfully.",
      data: {
        issue,
      },
    });
  }
);

export const getIssues = asyncHandler(
  async (req, res) => {
    const issues = await Issue.find({
      createdBy: req.user._id,
    })
      .populate(
        "municipality",
        "name organizationType"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: issues.length,
      message:
        issues.length === 0
          ? "There are no reported issues yet."
          : "Reports retrieved successfully.",
      data: {
        issues,
      },
    });
  }
);

export const getIssueById = asyncHandler(
  async (req, res) => {
    const issue =
      await getIssueByIdService({
        issueId:
          req.params.issueId,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      data: {
        issue,
      },
    });
  }
);

export const removeIssue = asyncHandler(
  async (req, res) => {
    const issue = await Issue.findOne({
      _id: req.params.issueId,
      createdBy: req.user._id,
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    if (issue.status !== ISSUE_STATUSES.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Only pending reports can be deleted.",
      });
    }

    await issue.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Report deleted successfully.",
    });
  }
);

export const updateIssue = asyncHandler(
  async (req, res) => {
    const issue = await updateIssueService({
      issueId: req.params.issueId,
      payload: req.body,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message:
        "Issue updated successfully.",
      data: {
        issue,
      },
    });
  }
);

export const supportExistingIssue = asyncHandler(
  async (req, res) => {
    const issue = await supportExistingIssueService({
      issueId: req.params.issueId,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Issue supported successfully.",
      data: {
        issue,
      },
    });
  }
);

export const removeIssueSupport = asyncHandler(
  async (req, res) => {
    const issue =
      await removeSupportIssueService({
        issueId: req.params.issueId,
        authenticatedUser: req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Issue support removed successfully.",
      data: {
        issue,
      },
    });
  }
);

export const submitIssue= asyncHandler(
  async (req, res) => {
    const issue =
      await submitIssueService({
        issueId: req.params.issueId,
        authenticatedUser: req.user,
      });
    
     return res.status(200).json({
      success: true,
      message:
        "Issue submitted successfully.",
      data: {
        issue,
      },
    });
  }

)

export const reviewIssue = asyncHandler(
  async (req, res) => {
    const {
      decision,
      notes,
    } = req.body;

    if (!decision) {
      throw AppError.badRequest(
        "Municipality review decision is required."
      );
    }

    const issue =
      await reviewIssueService({
        issueId:
          req.params.issueId,

        decision,

        notes,

        authenticatedUser:
          req.user,
      });

    return res.status(200).json({
      success: true,
      message:
        "Municipality review recorded successfully.",
      data: {
        issue,
      },
    });
  }
);


export const deleteIssue = asyncHandler(
  async (req, res) => {
    const result = await deleteIssueService({
      issueId: req.params.issueId,
      authenticatedUser: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Issue permanently deleted.",
      data: result,
    });
  },
);
export const convertIssueToInitiative =
  asyncHandler(async (req, res) => {
    const result =
      await convertIssueToInitiativeService({
        issueId:
          req.params.issueId,

        payload:
          req.body,

        authenticatedUser:
          req.user,
      });

    return res.status(201).json({
      success: true,

      message:
        "Issue converted into an initiative successfully.",

      data: {
        issue:
          result.issue,

        initiative:
          result.initiative,
      },
    });
  });
