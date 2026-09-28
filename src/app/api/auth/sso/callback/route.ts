import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeSsoFlow, getSsoConfig, SSO_FLOW_COOKIE, validCentralIdentity } from "@/lib/sso";

function loginRedirect(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/login?sso=${encodeURIComponent(reason)}`, request.url));
  response.cookies.delete(SSO_FLOW_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const flow = decodeSsoFlow(request.cookies.get(SSO_FLOW_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  if (!flow || state !== flow.state || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    return loginRedirect(request, "invalid");
  }

  let config;
  try {
    config = getSsoConfig(request.nextUrl.origin);
  } catch {
    config = null;
  }
  if (!config) return loginRedirect(request, "unavailable");

  try {
    const exchange = await fetch(new URL("/api/sso/exchange", config.issuer), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: flow.verifier
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const payload = await exchange.json() as { identity?: unknown };
    if (!exchange.ok || !validCentralIdentity(payload.identity)) return loginRedirect(request, "expired");
    const identity = payload.identity;

    let user = await prisma.user.findUnique({ where: { ssoSubject: identity.sub } });
    if (!user) {
      const candidate = await prisma.user.findFirst({
        where: { username: { equals: identity.username, mode: "insensitive" } }
      });
      if (!candidate || (candidate.ssoSubject && candidate.ssoSubject !== identity.sub)) {
        return loginRedirect(request, "unlinked");
      }
      user = await prisma.user.update({ where: { id: candidate.id }, data: { ssoSubject: identity.sub } });
    }

    const token = createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: false,
      needsOnboarding: !user.workspaceId
    });
    const response = NextResponse.redirect(new URL(flow.next, request.url));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    response.cookies.delete(SSO_FLOW_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return loginRedirect(request, "failed");
  }
}
