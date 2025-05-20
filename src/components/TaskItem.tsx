import type { Task } from '../db/schema';

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string, isComplete: boolean) => void;
}

export function TaskItem({ task, onDelete, onToggleComplete }: TaskItemProps) {
  return (
    <li className="flex justify-between items-center gap-4 py-3 group hover:bg-gray-50 px-4 rounded-lg transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <input
          type="checkbox"
          checked={task.isComplete}
          onChange={(e) => onToggleComplete(task.id.toString(), e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={task.isComplete ? 'Mark as incomplete' : 'Mark as complete'}
        />
        <div className="min-w-0">
          <p className={`text-lg font-medium text-gray-900 break-words ${
            task.isComplete ? 'line-through text-gray-400' : ''
          }`}>
            {task.title}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(task.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id.toString())}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-2 -mr-2 rounded-full transition-colors"
        aria-label={`Delete task: ${task.title}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </li>
  );
}
