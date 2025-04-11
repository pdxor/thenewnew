import React from 'react';
import { Database } from '../../types/supabase';
import { Calendar, AlertCircle, Folder, CheckCircle } from 'lucide-react';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskCardProps {
  task: Task & { projects?: { title: string } | null };
  onMarkComplete?: (taskId: string) => Promise<void>;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onMarkComplete }) => {
  // Format date if available
  const formattedDate = task.due_date 
    ? new Date(task.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;
  
  // Determine priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle mark complete button click
  const handleMarkComplete = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent event bubbling
    if (onMarkComplete) {
      onMarkComplete(task.id);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow relative group ${task.status === 'done' ? 'opacity-70' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-medium text-gray-800 line-clamp-2 ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
          {task.title}
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>
      
      {task.description && (
        <p className={`text-gray-600 text-sm mb-3 line-clamp-2 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
          {task.description}
        </p>
      )}
      
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {formattedDate && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {formattedDate}
          </div>
        )}
        
        {task.is_project_task && task.projects && (
          <div className="flex items-center">
            <Folder className="h-3 w-3 mr-1" />
            {task.projects.title}
          </div>
        )}
      </div>

      {/* Complete button - only show for non-completed tasks */}
      {task.status !== 'done' && onMarkComplete && (
        <button
          onClick={handleMarkComplete}
          className="absolute top-2 right-2 bg-green-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mark as Complete"
        >
          <CheckCircle className="h-5 w-5" />
        </button>
      )}
      
      {/* Completed indicator */}
      {task.status === 'done' && (
        <div className="absolute top-0 right-0 bottom-0 left-0 bg-gray-100 bg-opacity-20 rounded-lg flex items-center justify-center">
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <CheckCircle className="h-4 w-4 mr-1" />
            Completed
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;