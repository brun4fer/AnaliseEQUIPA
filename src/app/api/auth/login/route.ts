import { cookies } from "next/headers";

import { createSessionToken, ensureInitialAdmin, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    await ensureInitialAdmin();
    const email = body.email?.trim().toLowerCase() || "";
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !body.password || !verifyPassword(body.password, user.passwordHash)) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const token = createSessionToken({ userId: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword });
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    return Response.json({ name: user.name, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not sign in." }, { status: 400 });
  }
}
