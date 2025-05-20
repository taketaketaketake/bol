import type { Article } from '../db/schema';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export async function fetchArticles(): Promise<ApiResponse<Article[]>> {
  try {
    console.info('[fetchArticles] [GET] Fetching articles from /api/articles');
    const response = await fetch('/api/articles');
    console.info(`[fetchArticles] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[fetchArticles] Failed to fetch articles, status: ${response.status}`);
      throw new Error('Failed to fetch articles');
    }
    const result = await response.json();
    console.info('[fetchArticles] Articles fetched successfully', result);
    return result;
  } catch (error) {
    console.error('[fetchArticles] Error fetching articles:', error);
    return { error: error instanceof Error ? error.message : 'Failed to fetch articles' };
  }
}

export async function saveArticle(article: Partial<Article>): Promise<ApiResponse<Article>> {
  try {
    console.info('[saveArticle] [POST] Saving article to /api/articles', article);
    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(article),
      credentials: 'same-origin',
    });

    console.info(`[saveArticle] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[saveArticle] Failed to save article, status: ${response.status}`);
      throw new Error('Failed to save article');
    }

    const result = await response.json();
    console.info('[saveArticle] Article saved successfully', result);
    return result;
  } catch (error) {
    console.error('[saveArticle] Error saving article:', error);
    return { error: error instanceof Error ? error.message : 'Failed to save article' };
  }
}

export async function deleteArticle(id: number): Promise<ApiResponse<{ success: boolean }>> {
  try {
    console.info(`[deleteArticle] [DELETE] Deleting article with ID ${id} from /api/articles`);
    const response = await fetch(`/api/articles/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });

    console.info(`[deleteArticle] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[deleteArticle] Failed to delete article, status: ${response.status}`);
      throw new Error('Failed to delete article');
    }

    const result = await response.json();
    console.info('[deleteArticle] Article deleted successfully', result);
    return result;
  } catch (error) {
    console.error('[deleteArticle] Error deleting article:', error);
    return { error: error instanceof Error ? error.message : 'Failed to delete article' };
  }
}

export async function updateArticle(article: Partial<Article>): Promise<ApiResponse<Article>> {
  try {
    console.info(`[updateArticle] [PATCH] Updating article ID ${article.id}`);
    const response = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(article),
      credentials: 'same-origin',
    });

    console.info(`[updateArticle] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[updateArticle] Failed to update article, status: ${response.status}`);
      throw new Error('Failed to update article');
    }

    const result = await response.json();
    console.info('[updateArticle] Article updated successfully', result);
    return result;
  } catch (error) {
    console.error('[updateArticle] Error updating article:', error);
    return { error: error instanceof Error ? error.message : 'Failed to update article' };
  }
}

export async function fetchArticle(id: number): Promise<ApiResponse<Article>> {
  try {
    console.info(`[fetchArticle] [GET] Fetching article with ID ${id} from /api/articles/${id}`);
    const response = await fetch(`${import.meta.env.PUBLIC_SITE_URL}/api/articles/${id}`, {
      credentials: 'same-origin',
    });

    console.info(`[fetchArticle] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[fetchArticle] Failed to fetch article, status: ${response.status}`);
      throw new Error('Failed to fetch article');
    }

    const result = await response.json();
    console.info('[fetchArticle] Article fetched successfully');
    return result;
  } catch (error) {
    console.error('[fetchArticle] Error fetching article:', error);
    return { error: error instanceof Error ? error.message : 'Failed to fetch article' };
  }
}
