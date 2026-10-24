export type ExchangeTokenRequest = {
  clientId: string;
  grantType: "authorization_code";
  code: string;
  redirectUri: string;
};
export type ExchangeTokenResponse = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
  idToken?: string;
};
export type GetUserInfoResponse = {
  openId: string;
  name?: string | null;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
  platforms?: string[];
};
export type GetUserInfoWithJwtRequest = {
  jwtToken: string;
  projectId: string;
};
export type GetUserInfoWithJwtResponse = GetUserInfoResponse & {
  taskUid?: string | null;
};
