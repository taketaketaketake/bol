import { useState, useEffect, useCallback } from 'react';
import type { Article } from '../../db/schema';
import { saveArticle, updateArticle } from '../../lib/api';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.css'

interface ArticleEditorProps {
  article: Partial<Article> | null;
  onCancel: () => void;
}

export default function ArticleEditor({ article, onCancel }: ArticleEditorProps) {
  const [title, setTitle] = useState(article?.title || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [excerpt, setExcerpt] = useState(article?.excerpt || '');
  const [content, setContent] = useState(article?.content || '');
  const [status, setStatus] = useState(article?.status || 'draft');
  const [featuredImage, setFeaturedImage] = useState(article?.featuredImage || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async (articleData: Partial<Article>) => {
    setIsSaving(true);
    try {
      let prepared: Partial<Article> = { ...articleData, updatedAt: new Date() };

      if (!prepared.slug && prepared.title) {
        prepared.slug = prepared.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-');
      }

      if (prepared.status === 'published' && !prepared.publishedAt) {
        prepared.publishedAt = new Date();
      }

      if (article?.id) {
        await updateArticle(prepared);
      } else {
        await saveArticle(prepared);
      }

      Swal.fire({
        icon: 'success',
        title: '儲存成功',
        text: '文章已成功儲存',
      });
    } catch (err) {
      console.error('Error saving article:', err);
      Swal.fire({
        icon: 'error',
        title: '儲存文章時發生錯誤',
        text: err instanceof Error ? err.message : '儲存文章時發生錯誤',
      });
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (article) {
      setTitle(article.title || '');
      setSlug(article.slug || '');
      setExcerpt(article.excerpt || '');
      setContent(article.content || '');
      setStatus(article.status || 'draft');
      setFeaturedImage(article.featuredImage || '');
    }
  }, [article]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave({
      ...article,
      title,
      slug,
      excerpt,
      content,
      status,
      featuredImage,
      updatedAt: new Date(),
      ...(status === 'published' && !article?.publishedAt && { publishedAt: new Date() })
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              標題 *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              URL 代稱 *
            </label>
            <input
              type="text"
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700">
              摘要
            </label>
            <textarea
              id="excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              內容 *
            </label>
            <textarea
              id="content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="featuredImage" className="block text-sm font-medium text-gray-700">
              精選圖片 URL
            </label>
            <input
              type="url"
              id="featuredImage"
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              狀態
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="draft">草稿</option>
              <option value="published">已發佈</option>
              <option value="archived">封存</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? '儲存中...' : '儲存'}
        </button>
      </div>
    </form>
  );
}
