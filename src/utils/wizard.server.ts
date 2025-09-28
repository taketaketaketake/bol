// src/utils/wizard.server.ts
// Astro-compatible wizard state management

import { getSession, commitSession } from "./session.server";

export type Wizard = {
  address?: { line1: string; city?: string; state?: string; postal?: string };
  dropoffAddress?: { line1: string; date: string } | null;
  date?: string; // YYYY-MM-DD
  phone?: string;
  orderType?: string;
  addons?: { [id: string]: number }; // For specialty items
  addonPrefs?: { eco?: boolean; hangDry?: boolean; rush?: boolean; notes?: string };
  customer?: { fullName: string; email: string };
  estimate?: { lbs?: number; unitRateCents?: number; rushFeeCents?: number; subtotalCents?: number };
};

export async function readWizard(request: Request): Promise<Wizard> {
  const session = getSession(request.headers.get("Cookie"));
  return (session.get("wizard") as Wizard) ?? {};
}

export async function writeWizard(request: Request, patch: Partial<Wizard>, redirectTo: string): Promise<Response> {
  const session = getSession(request.headers.get("Cookie"));
  const current = (session.get("wizard") as Wizard) ?? {};
  const merged = { ...current, ...patch };
  session.set("wizard", merged);

  const cookieHeader = commitSession(session);
  const headers: HeadersInit = {
    Location: redirectTo
  };

  if (cookieHeader) {
    headers["Set-Cookie"] = cookieHeader;
  }

  return new Response(null, {
    status: 302,
    headers
  });
}

export async function clearWizard(request: Request, redirectTo: string): Promise<Response> {
  const session = getSession(request.headers.get("Cookie"));
  session.unset("wizard");

  const cookieHeader = commitSession(session);
  const headers: HeadersInit = {
    Location: redirectTo
  };

  if (cookieHeader) {
    headers["Set-Cookie"] = cookieHeader;
  }

  return new Response(null, {
    status: 302,
    headers
  });
}