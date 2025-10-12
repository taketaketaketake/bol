import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const dbUrl = process.env.DATABASE_URL || 'Not found';
  return new Response(
    JSON.stringify({
      success: true,
      DATABASE_URL: dbUrl.substring(0, 60) + '...', // shorten output
      envLoaded: !!process.env.DATABASE_URL,
    }),
    { status: 200 }
  );
};