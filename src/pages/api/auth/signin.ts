import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const provider = formData.get("provider")?.toString();

  const validProviders = ["google", "github"];

  // Handle OAuth providers
  if (provider && validProviders.includes(provider)) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${new URL(request.url).origin}/auth/login`,
      },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return the OAuth URL as JSON
    return new Response(
      JSON.stringify({ url: data.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Handle email/password login
  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Please enter email and password' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Set session cookies
    const { access_token, refresh_token } = data.session;
    cookies.set("sb-access-token", access_token, {
      path: "/",
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    cookies.set("sb-refresh-token", refresh_token, {
      path: "/",
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return redirect("/dashboard");
  } catch (error) {
    const errorMessage = error instanceof Error ?
      (error.message.includes('Invalid login credentials') ? 'Email or password is incorrect' : error.message) :
      'Login failed, please try again';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
