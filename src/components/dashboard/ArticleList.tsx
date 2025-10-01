import type { Article } from '../../db/schema';

interface ArticleListProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
}

export default function ArticleList({ articles, onEdit, onDelete }: ArticleListProps) {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Published Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {articles.map((article) => (
            <tr key={article.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <a 
                  href={`/dashboard/article/${article.id}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 block"
                  onClick={(e) => e.stopPropagation()}
                >
                  {article.title}
                </a>
                <div className="text-xs text-gray-500">
                  ID: {article.id} • {new Date(article.createdAt).toLocaleDateString('en-US')}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(article.status)}`}
                >
                  {article.status === 'draft'
                    ? 'Draft'
                    : article.status === 'published'
                    ? 'Published'
                    : article.status === 'archived'
                    ? 'Archived'
                    : article.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {article.publishedAt ? new Date(article.publishedAt).toLocaleString('en-US') : 'Not published'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <a
                  href={`/dashboard/article/${article.id}`}
                  className="text-blue-600 hover:text-blue-900 mr-4"
                >
                  Edit
                </a>
                <button
                  onClick={() => onDelete(article.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
