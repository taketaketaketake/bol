import type { APIRoute } from "astro";

// Telnyx will POST inbound SMS/MMS JSON data here
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    console.log("📩 Incoming Telnyx message:", data);

    // Optional: basic validation
    if (!data?.data?.payload) {
      return new Response("Invalid payload", { status: 400 });
    }

    const { from, to, text } = data.data.payload;
    console.log(`Message from ${from} to ${to}: ${text}`);

    // TODO: Add your logic here:
    // - Save to Supabase or MongoDB
    // - Trigger an AI reply or LiveKit voice call
    // - Send auto-responses with Telnyx API

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telnyx webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
