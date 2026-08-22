export const APP_VERSION = __APP_VERSION__;
export const APP_GIT_SHA = __APP_GIT_SHA__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;

/**
 * Compact identity label for the UI, e.g. "v0.3.2 · a1b2c3d".
 * The short SHA is omitted for dev builds (where it is "dev").
 */
export function versionLabel(): string {
  const sha = APP_GIT_SHA && APP_GIT_SHA !== "dev" ? ` · ${APP_GIT_SHA}` : "";
  return `${APP_VERSION}${sha}`;
}
