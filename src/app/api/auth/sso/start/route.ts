import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { encodeSsoFlow, getSsoConfig, safeNextPath, SSO_FLOW_COOKIE, ssoFlowCookieOptions } from "@/lib/sso";

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getSsoConfig(request.nextUrl.origin);
  } catch {
    config = null;
  }
  if (!config) return NextResponse.redirect(new URL("/login?sso=unavailable", request.url));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const authorize = new URL("/api/sso/authorize", config.issuer);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SSO_FLOW_COOKIE, encodeSsoFlow({ state, verifier, next }), ssoFlowCookieOptions);
  return response;
}
