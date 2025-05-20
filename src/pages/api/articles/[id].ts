import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { eq } from "drizzle-orm";
import { articles } from "../../../db/schema";
import { db } from "../../../db/client";
import { z } from "zod";

// Zod schema for article updates (PATCH)
const ArticleUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1).optional(),
  authorId: z.string().optional(),
  featuredImage: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

/**
 * @description Handles GET requests to fetch a single article by ID.
 * @route /api/articles/[id]
 * @method GET
 */
export const GET: APIRoute = async ({ params }) => {
  console.info("[GET] Incoming article fetch request");
  const id = z.coerce.number().int().positive().parse(params.id);

  console.debug(`[GET] Fetching article ID ${id}`);
  const data = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!data.length) {
    console.warn(`[GET] No article found with ID ${id}`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Article not found',
    }), { status: 404 });
  }

  console.info(`[GET] Article ID ${id} fetched successfully`);
  return new Response(JSON.stringify({
    success: true,
    data: data[0],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * @description Handles PATCH requests to update an article. Requires authentication.
 * @route /api/articles/[id]
 * @method PATCH
 */
export const PATCH: APIRoute = async ({ request, params }) => {
  console.info("[PATCH] Incoming article update request");
  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    console.warn('[PATCH] Unauthorized attempt to update article');
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized',
    }), { status: 401 });
  }

  const id = z.coerce.number().int().positive().parse(params.id);

  const body = await request.json();
  const updateFields = ArticleUpdateSchema.parse(body);

  if (Object.keys(updateFields).length === 0) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No updatable fields provided',
    }), { status: 400 });
  }

  const updated = await db
    .update(articles)
    .set({
      title: updateFields.title,
      slug: updateFields.slug,
      excerpt: updateFields.excerpt,
      content: updateFields.content,
      authorId: updateFields.authorId,
      featuredImage: updateFields.featuredImage,
      status: updateFields.status,
    })
    .where(eq(articles.id, id))
    .returning();

  if (!updated.length) {
    console.warn(`[PATCH] No article found with ID ${id}`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Article not found',
    }), { status: 404 });
  }

  console.info(`[PATCH] Article ID ${id} updated by user ${user.data.user.id}`);
  return new Response(JSON.stringify({
    success: true,
    data: updated[0],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * @description Handles DELETE requests to mark an article as deleted.
 * @route /api/articles/[id]
 * @method DELETE
 */
export const DELETE: APIRoute = async ({ params }) => {
  console.info('[DELETE] Incoming article delete request');
  const id = z.coerce.number().int().positive().parse(params.id);

  console.debug(`[DELETE] Marking article ID ${id} as deleted`);
  const now = new Date();
  const result = await db
    .update(articles)
    .set({ isDeleted: true, deletedAt: now })
    .where(eq(articles.id, id))
    .returning();

  if (!result.length) {
    console.warn(`[DELETE] No article found with ID ${id} to delete`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Article not found',
    }), { status: 404 });
  }

  console.info(`[DELETE] Article ID ${id} marked as deleted`);
  return new Response(JSON.stringify({
    success: true,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;