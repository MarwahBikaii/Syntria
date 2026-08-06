import mongoose from "mongoose";

import connectDB from "../database.js";

import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";

import {
  USER_ROLES,
  ACCOUNT_STATUSES,
  USER_ROLES_IN_ORGANIZATION,
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  VERIFICATION_STATUSES,
} from "../constants/enums.js";

const TEST_PASSWORD = "Password123!";

/**
 * Create users one by one.
 *
 * User.create() triggers:
 * - schema validation
 * - passwordConfirm validation
 * - pre("save") password hashing
 */
const createUsers = async (usersData) => {
  const createdUsers = [];

  for (const userData of usersData) {
    const user = await User.create({
      ...userData,
      password: TEST_PASSWORD,
      passwordConfirm: TEST_PASSWORD,
    });

    createdUsers.push(user);
  }

  return createdUsers;
};

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("Connected to MongoDB.");

    /*
     * Warning:
     * This removes all current users and organizations.
     */
    await User.deleteMany({});
    await Organization.deleteMany({});

    console.log(
      "Existing users and organizations cleared."
    );

    /*
     * ---------------------------------------------------
     * Create organizations
     * ---------------------------------------------------
     */

    const organizations =
      await Organization.create([
        {
          organizationType:
            ORGANIZATION_TYPES.MUNICIPALITY,

          name: "Tripoli Municipality",

          description:
            "Municipality responsible for public services and community initiatives in Tripoli.",

          registrationNumber:
            "MUN-TRIPOLI-001",

          verificationStatus:
            VERIFICATION_STATUSES.VERIFIED,

          status:
            ORGANIZATION_STATUSES.ACTIVE,

          contact: {
            email:
              "contact@tripoli-municipality.test",
            phone: "+9616400001",
            websiteUrl:
              "https://tripoli-municipality.test",
          },

          address: {
            line: "Al Tell Square",
            city: "Tripoli",
            region: "North Lebanon",
            countryCode: "LB",
            locationType: "Point",

            // [longitude, latitude]
            coordinates: [35.8442, 34.4367],
          },
        },

        {
          organizationType:
            ORGANIZATION_TYPES
              .COMMUNITY_ORGANIZATION,

          name: "Green Future NGO",

          description:
            "Environmental community organization focused on clean-up initiatives and sustainability.",

          registrationNumber:
            "NGO-GREEN-001",

          verificationStatus:
            VERIFICATION_STATUSES.VERIFIED,

          status:
            ORGANIZATION_STATUSES.ACTIVE,

          contact: {
            email: "info@greenfuture.test",
            phone: "+96170123456",
            websiteUrl:
              "https://greenfuture.test",
          },

          address: {
            line: "Main Street",
            city: "Tripoli",
            region: "North Lebanon",
            countryCode: "LB",
            locationType: "Point",
            coordinates: [35.8308, 34.4367],
          },
        },

        {
          organizationType:
            ORGANIZATION_TYPES
              .COMMUNITY_ORGANIZATION,

          name: "Community Care Association",

          description:
            "Community organization supporting local social and volunteer initiatives.",

          registrationNumber:
            "NGO-CARE-002",

          verificationStatus:
            VERIFICATION_STATUSES.PENDING,

          status:
            ORGANIZATION_STATUSES.ACTIVE,

          contact: {
            email:
              "contact@communitycare.test",
            phone: "+96171112233",
            websiteUrl:
              "https://communitycare.test",
          },

          address: {
            line: "Azmi Street",
            city: "Tripoli",
            region: "North Lebanon",
            countryCode: "LB",
            locationType: "Point",
            coordinates: [35.8415, 34.4332],
          },
        },

        {
          organizationType:
            ORGANIZATION_TYPES.RESOURCE_PARTNER,

          name: "Lebanon Equipment Support",

          description:
            "Resource partner providing equipment, vehicles, and logistical support.",

          registrationNumber:
            "RP-EQUIPMENT-001",

          verificationStatus:
            VERIFICATION_STATUSES.VERIFIED,

          status:
            ORGANIZATION_STATUSES.ACTIVE,

          contact: {
            email: "support@equipment.test",
            phone: "+96171222333",
            websiteUrl:
              "https://equipment.test",
          },

          address: {
            line: "Industrial Zone",
            city: "Zgharta",
            region: "North Lebanon",
            countryCode: "LB",
            locationType: "Point",
            coordinates: [35.8959, 34.3974],
          },
        },

        {
          organizationType:
            ORGANIZATION_TYPES.RESOURCE_PARTNER,

          name: "North Medical Supplies",

          description:
            "Resource partner providing medical kits and safety supplies.",

          registrationNumber:
            "RP-MEDICAL-002",

          verificationStatus:
            VERIFICATION_STATUSES.PENDING,

          status:
            ORGANIZATION_STATUSES.ACTIVE,

          contact: {
            email: "info@northmedical.test",
            phone: "+96171333444",
            websiteUrl:
              "https://northmedical.test",
          },

          address: {
            line: "Health Services Road",
            city: "Mina",
            region: "North Lebanon",
            countryCode: "LB",
            locationType: "Point",
            coordinates: [35.8133, 34.4504],
          },
        },
      ]);

    const [
      tripoliMunicipality,
      greenFuture,
      communityCare,
      equipmentSupport,
      medicalSupplies,
    ] = organizations;

    console.log(
      `${organizations.length} organizations created.`
    );

    /*
     * ---------------------------------------------------
     * Define users
     * ---------------------------------------------------
     *
     * Do not add password here.
     * createUsers() adds the plain password and
     * passwordConfirm before calling User.create().
     */

    const usersData = [
      {
        firstName: "Ahmad",
        lastName: "Nasser",
        email:
          "ahmad.municipality@syntria.test",
        phone: "+96170000001",

        accountType: USER_ROLES.MUNICIPALITY,
        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId:
              tripoliMunicipality._id,

            role:
              USER_ROLES_IN_ORGANIZATION.OWNER,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Layla",
        lastName: "Hassan",
        email:
          "layla.municipality@syntria.test",
        phone: "+96170000002",

        accountType: USER_ROLES.MUNICIPALITY,
        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId:
              tripoliMunicipality._id,

            role:
              USER_ROLES_IN_ORGANIZATION.ADMIN,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Rana",
        lastName: "Khalil",
        email:
          "rana.greenfuture@syntria.test",
        phone: "+96170000003",

        accountType:
          USER_ROLES.COMMUNITY_ORGANIZATION,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId: greenFuture._id,

            role:
              USER_ROLES_IN_ORGANIZATION.OWNER,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Samer",
        lastName: "Fares",
        email:
          "samer.greenfuture@syntria.test",
        phone: "+96170000004",

        accountType:
          USER_ROLES.COMMUNITY_ORGANIZATION,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId: greenFuture._id,

            role:
              USER_ROLES_IN_ORGANIZATION.ADMIN,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Nour",
        lastName: "Hamdan",
        email:
          "nour.communitycare@syntria.test",
        phone: "+96170000005",

        accountType:
          USER_ROLES.COMMUNITY_ORGANIZATION,

        status: ACCOUNT_STATUSES.PENDING,

        memberships: [
          {
            organizationId:
              communityCare._id,

            role:
              USER_ROLES_IN_ORGANIZATION.OWNER,

            status:
              ACCOUNT_STATUSES.PENDING,
          },
        ],
      },

      {
        firstName: "Karim",
        lastName: "Saad",
        email:
          "karim.multiorg@syntria.test",
        phone: "+96170000006",

        accountType:
          USER_ROLES.COMMUNITY_ORGANIZATION,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId: greenFuture._id,

            role:
              USER_ROLES_IN_ORGANIZATION.MEMBER,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },

          {
            organizationId:
              communityCare._id,

            role:
              USER_ROLES_IN_ORGANIZATION.ADMIN,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Maya",
        lastName: "Haddad",
        email:
          "maya.equipment@syntria.test",
        phone: "+96170000007",

        accountType:
          USER_ROLES.RESOURCE_PARTNER,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId:
              equipmentSupport._id,

            role:
              USER_ROLES_IN_ORGANIZATION.OWNER,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Joseph",
        lastName: "Khoury",
        email:
          "joseph.equipment@syntria.test",
        phone: "+96170000008",

        accountType:
          USER_ROLES.RESOURCE_PARTNER,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [
          {
            organizationId:
              equipmentSupport._id,

            role:
              USER_ROLES_IN_ORGANIZATION.MEMBER,

            status:
              ACCOUNT_STATUSES.ACTIVE,
          },
        ],
      },

      {
        firstName: "Dalia",
        lastName: "Mansour",
        email:
          "dalia.medical@syntria.test",
        phone: "+96170000009",

        accountType:
          USER_ROLES.RESOURCE_PARTNER,

        status: ACCOUNT_STATUSES.PENDING,

        memberships: [
          {
            organizationId:
              medicalSupplies._id,

            role:
              USER_ROLES_IN_ORGANIZATION.OWNER,

            status:
              ACCOUNT_STATUSES.PENDING,
          },
        ],
      },

      {
        firstName: "Omar",
        lastName: "Saleh",
        email: "omar.member@syntria.test",
        phone: "+96170000010",

        accountType:
          USER_ROLES.COMMUNITY_MEMBER,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [],

        volunteerProfile: {
          isActive: true,

          qualifications: [
            "First Aid Certificate",
          ],

          serviceAreas: [
            "Tripoli",
            "Mina",
          ],

          skills: [
            "First Aid",
            "Community Outreach",
            "Event Support",
          ],
        },
      },

      {
        firstName: "Sara",
        lastName: "Ali",
        email: "sara.member@syntria.test",
        phone: "+96170000011",

        accountType:
          USER_ROLES.COMMUNITY_MEMBER,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [],

        volunteerProfile: {
          isActive: true,

          qualifications: [
            "Environmental Awareness Training",
          ],

          serviceAreas: ["Tripoli"],

          skills: [
            "Recycling",
            "Photography",
            "Public Awareness",
          ],
        },
      },

      {
        firstName: "Tarek",
        lastName: "Youssef",
        email:
          "tarek.member@syntria.test",
        phone: "+96170000012",

        accountType:
          USER_ROLES.COMMUNITY_MEMBER,

        status: ACCOUNT_STATUSES.ACTIVE,

        memberships: [],

        volunteerProfile: {
          isActive: false,
          qualifications: [],
          serviceAreas: [],
          skills: [],
        },
      },

      {
        firstName: "Hiba",
        lastName: "Mahmoud",
        email:
          "hiba.suspended@syntria.test",
        phone: "+96170000013",

        accountType:
          USER_ROLES.COMMUNITY_MEMBER,

        status: ACCOUNT_STATUSES.SUSPENDED,

        memberships: [],

        volunteerProfile: {
          isActive: false,
          qualifications: [],
          serviceAreas: [],
          skills: [],
        },
      },

      {
        firstName: "Fadi",
        lastName: "Ibrahim",
        email:
          "fadi.deactivated@syntria.test",
        phone: "+96170000014",

        accountType:
          USER_ROLES.COMMUNITY_MEMBER,

        status:
          ACCOUNT_STATUSES.DEACTIVATED,

        memberships: [],

        volunteerProfile: {
          isActive: false,
          qualifications: [],
          serviceAreas: [],
          skills: [],
        },
      },
    ];

    /*
     * Create users one by one so pre("save")
     * hashes every password.
     */
    const users = await createUsers(usersData);

    console.log(
      `${users.length} users created.`
    );

    /*
     * ---------------------------------------------------
     * Verify password hashing
     * ---------------------------------------------------
     */

    const verificationUser =
      await User.findOne({
        email: "omar.member@syntria.test",
      }).select("+password");

    if (!verificationUser) {
      throw new Error(
        "Verification user was not found."
      );
    }

    const isHashed =
      verificationUser.password !==
        TEST_PASSWORD &&
      verificationUser.password.length === 60 &&
      verificationUser.password.startsWith("$2");

    const passwordMatches =
      await verificationUser.checkPassword(
        TEST_PASSWORD
      );

    console.log(
      "Password verification:",
      {
        hashPrefix:
          verificationUser.password.slice(0, 7),

        hashLength:
          verificationUser.password.length,

        isHashed,
        passwordMatches,
      }
    );

    if (!isHashed || !passwordMatches) {
      throw new Error(
        "Password hashing verification failed."
      );
    }

    console.log(
      "\nSeed completed successfully."
    );

    console.log(
      `All test users use password: ${TEST_PASSWORD}`
    );

    console.table(
      users.map((user) => ({
        email: user.email,
        accountType: user.accountType,
        status: user.status,
        memberships:
          user.memberships.length,
      }))
    );
  } catch (error) {
    console.error("\nSeed failed:");

    if (error.name === "ValidationError") {
      for (const validationError of Object.values(
        error.errors
      )) {
        console.error(
          `${validationError.path}: ${validationError.message}`
        );
      }
    } else if (error.code === 11000) {
      console.error(
        "Duplicate value:",
        error.keyValue
      );
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();

    console.log(
      "MongoDB connection closed."
    );
  }
};

seedDatabase();