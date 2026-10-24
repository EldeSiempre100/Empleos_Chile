export const COOKIE_NAME = "webdev_app_session";
export const OAUTH_STATE_COOKIE = "empleos_oauth_nonce";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const AXIOS_TIMEOUT_MS = 15000;
export const UNAUTHED_ERR_MSG = "Sesión no autorizada";
export type OAuthState = { redirectUri: string; nonce: string };
export function encodeOAuthState(state: OAuthState): string {
  return btoa(JSON.stringify(state));
}
export function decodeOAuthState(state: string): OAuthState {
  try {
    const data: unknown = JSON.parse(atob(state));
    if (!data || typeof data !== "object") throw new Error("Invalid state");
    const value = data as Record<string, unknown>;
    if (typeof value.redirectUri !== "string" || typeof value.nonce !== "string") throw new Error("Invalid state fields");
    const uri = new URL(value.redirectUri);
    if (uri.pathname !== "/api/oauth/callback" || !["https:", "http:"].includes(uri.protocol)) throw new Error("Invalid callback URI");
    return { redirectUri: value.redirectUri, nonce: value.nonce };
  } catch {
    return { redirectUri: "", nonce: "" };
  }
}
