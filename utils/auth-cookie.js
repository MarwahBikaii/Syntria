const getRefreshCookieDays = () => {
  const configuredDays = Number(
    process.env.JWT_REFRESH_COOKIE_DAYS,
  );

  return Number.isFinite(configuredDays) &&
    configuredDays > 0
    ? configuredDays
    : 7;
};

export const REFRESH_COOKIE_NAME =
  "syntria_refresh_token";

export const getRefreshCookieOptions = () => {
  const isProduction =
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge:
      getRefreshCookieDays() *
      24 *
      60 *
      60 *
      1000,
    path: "/api/auth",
  };
};

export const getClearRefreshCookieOptions = () => {
  const options = getRefreshCookieOptions();

  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  };
};