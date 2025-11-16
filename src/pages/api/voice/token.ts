import type { APIRoute } from "astro";
import { createAgentToken } from "../../../lib/livekitServer";

export const GET: APIRoute = async () => {
  const jwt = await createAgentToken("browser-tester");
  return new Response(JSON.stringify({ token: jwt }), {
    headers: { "Content-Type": "application/json" },
  });
};
