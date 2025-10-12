import { db } from '../../db/client';
import { articles } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { requireAuth, createAuthErrorResponse } from '../../utils/require-auth';
import { requireAdmin } from '../../utils/require-roles';

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
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Require admin access for article creation
    const { user } = await requireAdmin(cookies);

    const articleData = await request.json();
    articleData.authorId = user.id;

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
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create article',
    }), {
      status: 500,
    });
  }
};

/**
 * @description Handles PATCH requests to update an existing article. Requires admin access.
 * @route /api/articles
 * @method PATCH
 * @param {Request} request - The request object containing article ID and update data in JSON body.
 * @returns {Response} JSON response containing the updated article or an error message.
 */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    // Require admin access for article updates
    const { user } = await requireAdmin(cookies);

    const { id, ...updateData } = await request.json();
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Article ID is required',
      }), {
        status: 400,
      });
    }

    // Add updated timestamp
    updateData.updatedAt = new Date();

    const updated = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    if (updated.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Article not found',
      }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: updated[0],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PATCH] Error updating article:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update article',
    }), {
      status: 500,
    });
  }
};

/**
 * @description Handles DELETE requests to soft-delete an article. Requires admin access.
 * @route /api/articles
 * @method DELETE
 * @param {Request} request - The request object containing article ID in JSON body.
 * @returns {Response} JSON response confirming deletion or an error message.
 */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    // Require admin access for article deletion
    const { user } = await requireAdmin(cookies);

    const { id } = await request.json();
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Article ID is required',
      }), {
        status: 400,
      });
    }

    // Soft delete by setting isDeleted to true
    const deleted = await db
      .update(articles)
      .set({ 
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(articles.id, id))
      .returning();

    if (deleted.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Article not found',
      }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Article deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[DELETE] Error deleting article:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete article',
    }), {
      status: 500,
    });
  }
};
