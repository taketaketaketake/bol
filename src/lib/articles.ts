import { db } from '../db/client';
import { articles, type Article } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * Fetches a list of articles ordered by published date (descending).
 * @param {number} [limit] - Optional maximum number of articles to fetch.
 * @returns {Promise<Article[]>} Resolves with an array of articles.
 */
export async function getArticles(limit?: number): Promise<Article[]> {
  let query = db.select().from(articles).orderBy(desc(articles.publishedAt));

  if (limit) {
    return await query.limit(limit);
  }

  return await query;
}

/**
 * Fetches a single article by its ID.
 * @param {number} id - The ID of the article to fetch.
 * @returns {Promise<Article | null>} Resolves with the article object or null if not found.
 */
export async function getArticleById(id: number): Promise<Article | null> {
  const result = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  return result[0] || null;
}
