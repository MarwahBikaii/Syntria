import jwt from "jsonwebtoken";
import mongoose from 'mongoose'
import  User  from "../models/userModel.js";
import  Organization  from "../models/OrganizationModel.js";
import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  USER_ROLES_IN_ORGANIZATION,
  ORGANIZATION_TYPES,
} from "../constants/enums.js";

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const allowedPublicRoles = [
  USER_ROLES.COMMUNITY_MEMBER,
  USER_ROLES.COMMUNITY_ORGANIZATION,
  USER_ROLES.RESOURCE_PARTNER,
];

const organizationAccountTypes = [
  USER_ROLES.COMMUNITY_ORGANIZATION,
  USER_ROLES.RESOURCE_PARTNER,
];

        const signToken = (id, res) => {
            const token = jwt.sign(
              { id }, //payload
              process.env.JWT_SECRET, { //secret key
            expiresIn: process.env.JWT_EXPIRES_IN, //expiring period
            });
        
            // Set the JWT as a cookie
            // name , value, options
            res.cookie('jwt', token, {
            httpOnly: true,// Blocks client-side JavaScript access 
            secure: process.env.NODE_ENV === 'production', //make sure cookie is only sent over encrypted https connections
            // Set to true in production, false in development
            sameSite: 'strict',// Blocks cross-site transmission 
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            });
        
            return token;
        };

     const createSendToken = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.cookie("jwt", token, {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: "Strict",
  });

  res.status(statusCode).json({
    status: "success",
    token, // ✅ Sending token in response
    data: { user },
  });

  return token; // ✅ Return the generated token
};



export const signup = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      passwordConfirm,
      phone,
      accountType,
      location,
      organizationId,
    } = req.body;

    const longitude= location.coordinates.coordinates[0];
    const latitude= location.coordinates.coordinates[1];

    // const [longitude,latitude]= location..coordinates.coordinates;
    
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !passwordConfirm ||
      !accountType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, email, password, password confirmation, and account type are required.",
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (
      !allowedPublicRoles.includes(accountType)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This account type cannot be selected during public registration.",
      });
    }
    
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

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    const organizationAccountTypes = [
      USER_ROLES.COMMUNITY_ORGANIZATION,
      USER_ROLES.RESOURCE_PARTNER,
    ];

    let memberships = [];

    if (
      organizationAccountTypes.includes(accountType)
    ) {
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message:
            "An organization ID is required for this account type.",
        });
      }

      if (
        !mongoose.isValidObjectId(organizationId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid organization identifier.",
        });
      }

      const organization =
        await Organization.findById(organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found.",
        });
      }

      if (
        organization.organizationType !==
        accountType
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The organization type does not match the selected account type.",
        });
      }

      memberships = [
        {
          organizationId: organization._id,
          role:
            USER_ROLES_IN_ORGANIZATION.MEMBER,
          status: ACCOUNT_STATUSES.PENDING,
        },
      ];
    }

    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      location:location,
      passwordConfirm,
      phone: phone || null,
      accountType,

      status:
        accountType ===
        USER_ROLES.COMMUNITY_MEMBER
          ? ACCOUNT_STATUSES.ACTIVE
          : ACCOUNT_STATUSES.PENDING,

      memberships,
    });

    return createSendToken(user, 201, res);
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "User validation failed.",
        errors: Object.values(error.errors).map(
          (validationError) =>
            validationError.message
        ),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create the account.",
    });
  }
};

export const login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    if (user.status === ACCOUNT_STATUSES.PENDING) {
      return res.status(403).json({
        success: false,
        message: "Your account is awaiting approval.",
      });
    }

    if (user.status === ACCOUNT_STATUSES.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended.",
      });
    }

    if (user.status === ACCOUNT_STATUSES.DEACTIVATED) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }


    return createSendToken(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
};

export const logout = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};