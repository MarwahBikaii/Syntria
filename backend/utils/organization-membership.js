import {
  ACCOUNT_STATUSES,
} from "../constants/enums.js";

export const getActiveMemberships = (user) => {
  return (
    user.memberships?.filter(
      (membership) =>
        membership.status ===
        ACCOUNT_STATUSES.ACTIVE
    ) ?? []
  );
};

export const getActiveMembershipByOrganizationId = (
  user,
  organizationId
) => {
  return getActiveMemberships(user).find(
    (membership) =>
      membership.organizationId.toString() ===
      organizationId.toString()
  );
};