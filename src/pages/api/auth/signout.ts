export const prerender = false;
import type { APIRoute } from "astro";
import { rateLimit, RATE_LIMITS } from "../../../utils/rate-limit";

export const GET: APIRoute = async ({ cookies, redirect, request }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
  return redirect("/");
};