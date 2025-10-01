import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Missing tokens' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set session cookies
    cookies.set('sb-access-token', access_token, {
      path: '/',
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    cookies.set('sb-refresh-token', refresh_token, {
      path: '/',
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error setting session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to set session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
