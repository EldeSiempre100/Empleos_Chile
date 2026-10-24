/** Only these two public, non-secret settings may reach the browser. */
export function publicPlatformScript(): string {
  const config = JSON.stringify({
    projectId: process.env.MANUS_PROJECT_ID || "",
    oauthPortalUrl: process.env.MANUS_OAUTH_PORTAL_URL || "",
  }).replace(/</g, "\\u003c");
  return "window.__MANUS_CONFIG__ = " + config + ";";
}
