import mongoose from "mongoose";

import  User  from "../models/userModel.js";
import {
  ACCOUNT_STATUSES,
  USER_ROLES,
} from "../constants/enums.js";

const profileFields = [
  "firstName",
  "lastName",
  "phone",
  "avatarUrl",
];

const volunteerProfileFields = [

  "qualifications",
  "serviceAreas",
  "skills"
];

const publicUserFields = [
  "_id",
  "firstName",
  "lastName",
  "fullName",
  "role",
  "organization",
  "avatarUrl",
  "volunteerProfile.skills",
  "volunteerProfile.qualifications",
  "volunteerProfile.serviceAreas",
  "volunteerProfile.isActive",
  "createdAt",
].join(" ");

const pickFields = (source, allowedFields) =>
  allowedFields.reduce((result, field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }

    return result;
  }, {});

  //use authorization token in header instead
export const getProfile = async (
  req,
  res
) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

export const updateProfile = async (req, res, next) => {
  try {
    const forbiddenFields = [
      "email",
      "password",
      "passwordConfirm",
      "accountType",
      "status",
      "memberships",
      "volunteerProfile",
      "createdAt",
      "updatedAt",
    ];

    const submittedForbiddenFields =
      forbiddenFields.filter(
        (field) => req.body[field] !== undefined
      );

    if (submittedForbiddenFields.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "One or more fields cannot be updated through this endpoint.",
        fields: submittedForbiddenFields,
      });
    }

    const updates = pickFields(
      req.body,
      profileFields
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid profile fields were provided.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate({
      path: "memberships.organizationId",
      select:
        "name organizationType verificationStatus status contact address",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully.",
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePassword = async(req,res) =>{
  try{
    const {
      currentPassword,
      newPassword,
      newPasswordConfirm,
    } = req.body;

    if (
      !currentPassword ||
      !newPassword ||
      !newPasswordConfirm
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password, and password confirmation are required.",
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least 8 characters.",
      });
    }

    const user = await User.findById(
      req.user._id
    ).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const currentPasswordIsCorrect =
      await user.checkPassword(
        currentPassword
      );

    if (!currentPasswordIsCorrect) {
      return res.status(401).json({
        success: false,
        message:
          "Your current password is incorrect.",
      });
    }

    const sameAsCurrentPassword =
      await user.checkPassword(
        newPassword
      );

    if (sameAsCurrentPassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from the current password.",
      });
    }

    user.password = newPassword;
    user.passwordConfirm =
      newPasswordConfirm;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password updated successfully.",
    });

  }catch(error){
return next(error);
  }
}

export const activateVolunteerProfile = async (
  req,
  res,
  next
) => {
  try {
    if (
      req.user.accountType !==
      USER_ROLES.COMMUNITY_MEMBER
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Community Members can activate volunteer profiles.",
      });
    }

    const updates = pickFields(
      req.body,
      volunteerProfileFields
    );
    console.log("HITTTTTTTT",updates)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one volunteer profile field is required.",
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.volunteerProfile = {
      isActive: true,
      skills:
        updates.skills ??
        user.volunteerProfile?.skills ??
        [],
      qualifications:
        updates.qualifications ??
        user.volunteerProfile
          ?.qualifications ??
        [],
      serviceAreas:
        updates.serviceAreas ??
        user.volunteerProfile?.serviceAreas ??
        [],
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Volunteer profile activated successfully.",
      data: {
        volunteerProfile:
          user.volunteerProfile,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateVolunteerProfile = async (req, res) => {
  try {
    if (req.user.accountType !== USER_ROLES.COMMUNITY_MEMBER) {
      return res.status(403).json({
        success: false,
        message:
          "Only Community Members can manage volunteer profiles.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "volunteerProfile.isActive": false,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Volunteer profile deactivated successfully.",
      data: {
        volunteerProfile: user.volunteerProfile,
      },
    });
  } catch (error) {
    console.error("Deactivate volunteer profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate the volunteer profile.",
    });
  }
};
export const updateVolunteerProfile = async (
  req,
  res,
  next
) => {
  try {
    if (
      req.user.accountType !==
      USER_ROLES.COMMUNITY_MEMBER
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Community Members can update volunteer profiles.",
      });
    }

    const allowedFields = [
      "skills",
      "qualifications",
      "serviceAreas",
    ];

    const updates = pickFields(
      req.body,
      allowedFields
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one volunteer profile field is required.",
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.volunteerProfile = {
      isActive:
        user.volunteerProfile?.isActive ??
        false,

      skills:
        updates.skills ??
        user.volunteerProfile?.skills ??
        [],

      qualifications:
        updates.qualifications ??
        user.volunteerProfile
          ?.qualifications ??
        [],

      serviceAreas:
        updates.serviceAreas ??
        user.volunteerProfile
          ?.serviceAreas ??
        [],
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Volunteer profile updated successfully.",
      data: {
        volunteerProfile:
          user.volunteerProfile,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
          "volunteerProfile.isActive": false,
          refreshTokenHash: null,
        },
      },
      {
        new: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.cookie("jwt", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      expires: new Date(0),
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully.",
    });
  } catch (error) {
    console.error("Deactivate account error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate the account.",
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const {
      search,
      role,
      organization,
      serviceArea,
      volunteerActive,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(
      Number.parseInt(page, 10) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 20, 1),
      100,
    );

    const query = {
      accountStatus: {
        $ne: ACCOUNT_STATUSES.DEACTIVATED,
      },
    };

    if (role) {
      query.role = role;
    }

    if (organization) {
      if (!mongoose.isValidObjectId(organization)) {
        return res.status(400).json({
          success: false,
          message: "Invalid organization identifier.",
        });
      }

      query.organization = organization;
    }

    if (serviceArea) {
      query["volunteerProfile.serviceAreas"] = {
        $regex: serviceArea,
        $options: "i",
      };
    }

    if (volunteerActive !== undefined) {
      query["volunteerProfile.isActive"] =
        volunteerActive === "true";
    }

    if (search) {
      query.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(publicUserFields)
        .populate("organization")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageLimit)
        .limit(pageLimit)
        .lean({
          virtuals: true,
        }),

      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      results: users.length,
      pagination: {
        page: pageNumber,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit),
      },
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users.",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user identifier.",
      });
    }

    const user = await User.findOne({
      _id: userId,
      accountStatus: {
        $ne: ACCOUNT_STATUSES.DEACTIVATED,
      },
    })
      .select(publicUserFields)
      .populate("organization");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the user.",
    });
  }
};