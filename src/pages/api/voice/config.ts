import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const url = process.env.LIVEKIT_URL;
  if (!url) {
    return new Response(JSON.stringify({ error: "LIVEKIT_URL not set" }), { status: 500 });
  }

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" },
  });
};
