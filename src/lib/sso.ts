const SSO_CLIENT_ID = "analise-equipa";

export const SSO_FLOW_COOKIE = "analise_equipa_sso_flow";

export type SsoFlow = {
  state: string;
  verifier: string;
  next: string;
};

export type CentralIdentity = {
  sub: string;
  username: string;
  workspaceId: number;
  workspaceName: string;
  workspaceSlug: string;
};

function secureOrigin(value: string, label: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error(`${label} must use HTTPS, except on localhost.`);
  }
  return url.origin;
}

export function getSsoConfig(requestOrigin: string) {
  if (process.env.SSO_ENABLED !== "true") return null;
  const secret = process.env.SSO_CLIENT_SECRET?.trim() || "";
  const issuer = secureOrigin(process.env.SSO_ISSUER_URL?.trim() || "", "SSO_ISSUER_URL");
  const appOrigin = secureOrigin(process.env.SSO_APP_URL?.trim() || requestOrigin, "SSO_APP_URL");
  if (!secret) throw new Error("SSO_CLIENT_SECRET is not configured.");
  return {
    clientId: SSO_CLIENT_ID,
    clientSecret: secret,
    issuer,
    redirectUri: `${appOrigin}/api/auth/sso/callback`
  };
}

export function safeNextPath(value: string | null | undefined) {
  if (
    !value ||
    value.length > 1000 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  ) return "/";
  return value;
}

export function encodeSsoFlow(flow: SsoFlow) {
  return Buffer.from(JSON.stringify(flow)).toString("base64url");
}

export function decodeSsoFlow(value: string | undefined): SsoFlow | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SsoFlow>;
    if (
      !parsed.state ||
      !/^[A-Za-z0-9_-]{20,200}$/.test(parsed.state) ||
      !parsed.verifier ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(parsed.verifier)
    ) return null;
    return { state: parsed.state, verifier: parsed.verifier, next: safeNextPath(parsed.next) };
  } catch {
    return null;
  }
}

export function validCentralIdentity(value: unknown): value is CentralIdentity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Record<string, unknown>;
  return (
    typeof identity.sub === "string" && /^[0-9a-f-]{36}$/i.test(identity.sub) &&
    typeof identity.username === "string" && identity.username.length >= 3 && identity.username.length <= 80 &&
    typeof identity.workspaceId === "number" && Number.isInteger(identity.workspaceId) &&
    typeof identity.workspaceName === "string" && identity.workspaceName.length > 0 &&
    typeof identity.workspaceSlug === "string" && identity.workspaceSlug.length > 0
  );
}

export const ssoFlowCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 5
};
