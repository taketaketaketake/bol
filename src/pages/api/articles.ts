import { db } from '../../db/client';
import { articles } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const prerender = false;

/**
 * @description Handles GET requests to fetch all non-deleted articles, ordered by published date descending.
 * @route /api/articles
 * @method GET
 * @returns {Response} JSON response containing an array of articles or an error message.
 */
export const GET: APIRoute = async () => {
  try {
    console.info('[GET] Fetching articles...');
    const data = await db
      .select()
      .from(articles)
      .where(eq(articles.isDeleted, false))
      .orderBy(desc(articles.publishedAt));
    console.info(`[GET] Successfully fetched ${data.length} articles`);
    return new Response(JSON.stringify({
      success: true,
      data,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[GET] Error fetching articles:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch articles',
    }), {
      status: 500,
    });
  }
};

/**
 * @description Handles POST requests to create a new article. Requires authentication.
 * @route /api/articles
 * @method POST
 * @param {Request} request - The request object containing article data in JSON body.
 * @returns {Response} JSON response containing the created article or an error message.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      console.warn('[POST] Unauthorized attempt to create article');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
      }), {
        status: 401,
      });
    }

    const articleData = await request.json();
    articleData.authorId = user.data.user.id;

    // Generate slug if not provided
    if (!articleData.slug && articleData.title) {
      articleData.slug = articleData.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-');
    }

    // Timestamps
    const now = new Date();
    articleData.createdAt = now;
    articleData.updatedAt = now;
    articleData.isDeleted = false;

    const inserted = await db
      .insert(articles)
      .values(articleData)
      .returning();

    return new Response(JSON.stringify({
      success: true,
      data: inserted[0],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[POST] Error creating article:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create article',
    }), {
      status: 500,
    });
  }
};
