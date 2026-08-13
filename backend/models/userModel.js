import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  USER_ROLES,
  ACCOUNT_STATUSES,USER_ROLES_IN_ORGANIZATION
} from "../constants/enums.js";

const { Schema, model } = mongoose;


const membershipSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES_IN_ORGANIZATION),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUSES),
      default: ACCOUNT_STATUSES.PENDING,
      required: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    _id: false,
  }
);

/**
 * Embedded volunteer profile.
 *
 * Only Community Members are expected to activate
 * and use this profile.
 */
const volunteerProfileSchema = new Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
    },

    qualifications: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    serviceAreas: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    skills: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required."],
      trim: true,
      minlength: [2, "First name must contain at least 2 characters."],
      maxlength: [50, "First name cannot exceed 50 characters."],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required."],
      trim: true,
      minlength: [2, "Last name must contain at least 2 characters."],
      maxlength: [50, "Last name cannot exceed 50 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [150, "Email cannot exceed 150 characters."],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address.",
      ],
    },

    password: {
  type: String,
  required: [true, "Password is required."],
  minlength: [8, "Password must be at least 8 characters."],
  select: false,
},

passwordConfirm: {
  type: String,
  required: [
    function () {
      return this.isNew || this.isModified("password");
    },
    "Please confirm your password.",
  ],
  select: false,
  validate: {
    validator: function (value) {
      // Only works on CREATE and SAVE
      return value === this.password;
    },
    message: "Passwords do not match.",
  },
},



    phone: {
      type: String,
      trim: true,
      default: null,
      maxlength: [30, "Phone number cannot exceed 30 characters."],
    },

    accountType: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: "{VALUE} is not a valid account type.",
      },
      required: [true, "Account type is required."],
      immutable: true,
    },

    status: {
      type: String,
      enum: {
        values: Object.values(ACCOUNT_STATUSES),
        message: "{VALUE} is not a valid account status.",
      },
      default: ACCOUNT_STATUSES.PENDING
      ,
      required: true,
    },

    memberships: {
      type: [membershipSchema],
      default: [],
    },

    volunteerProfile: {
      type: volunteerProfileSchema,
      default: () => ({
        isActive: false,
        qualifications: [],
        serviceAreas: [],
        skills: [],
      }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "users",
    toJSON: {
  virtuals: true,
  transform: (_, returnedObject) => {
    delete returnedObject.password;
    delete returnedObject.passwordConfirm;
    return returnedObject;
  },
},
toObject: {
  virtuals: true,
  transform: (_, returnedObject) => {
    delete returnedObject.password;
    delete returnedObject.passwordConfirm;
    return returnedObject;
  },
},
  }
);




/**
 * Volunteer profiles are only valid for Community Members.
 */
userSchema.pre("validate", function validateVolunteerProfile() {
  const isCommunityMember =
    this.accountType === USER_ROLES.COMMUNITY_MEMBER;

  const hasActiveVolunteerProfile =
    this.volunteerProfile?.isActive === true;

  if (!isCommunityMember && hasActiveVolunteerProfile) {
    throw new Error(
      "Only Community Members can activate a volunteer profile."
    );
  }
});
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

});


// Instance method to check password
userSchema.methods.checkPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Prevent duplicate membership in the same organization.
 */
userSchema.pre(
  "validate",
  function preventDuplicateMemberships() {
    const organizationIds = this.memberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        membership.organizationId.toString()
      );

    const uniqueOrganizationIds = new Set(
      organizationIds
    );

    if (
      organizationIds.length !== uniqueOrganizationIds.size
    ) {
      throw new Error(
        "A user cannot have duplicate memberships in the same organization."
      );
    }
  }
);

/**
 * Helpful indexes.
 *
 * `unique: true` on email already creates a unique index,
 * but these indexes improve common dashboard queries.
 */
userSchema.index({ accountType: 1, status: 1 });
userSchema.index({ "memberships.organizationId": 1 });
userSchema.index({ "volunteerProfile.isActive": 1 });

const User = mongoose.models.User || model("User", userSchema);
export default User;