// src/utils/supabase.server.ts
// Astro-compatible Supabase server client

import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export const createSupabaseServerClient = (request: Request) => {
  const headers = new Headers()

  const supabase = createServerClient(
    import.meta.env.SUPABASE_URL!,
    import.meta.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
        },
      },
    }
  )

  return { supabase, headers }
}