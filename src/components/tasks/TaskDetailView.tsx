import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { CheckSquare, Calendar, AlertCircle, Edit, Trash2, Folder, User, Clock, Package, Plus, CheckCircle } from 'lucide-react';

type Task = Database['public']['Tables']['tasks']['Row'];
type InventoryItem = Database['public']['Tables']['items']['Row'];

const TaskDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<Task | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    
    const fetchTask = async () => {
      try {
        // Fetch task
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single();
          
        if (taskError) throw taskError;
        
        if (!taskData) {
          setError('Task not found');
          return;
        }
        
        setTask(taskData);
        
        // Fetch project name if task is associated with a project
        if (taskData.project_id) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('title')
            .eq('id', taskData.project_id)
            .single();
            
          if (projectError) console.error('Error fetching project:', projectError);
          else setProjectName(projectData?.title || null);
        }
        
        // Fetch assignee name if task is assigned to someone
        if (taskData.assigned_to) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', taskData.assigned_to)
            .single();
            
          if (profileError) console.error('Error fetching assignee:', profileError);
          else setAssigneeName(profileData?.name || 'Unknown User');
        }
        
        // Fetch inventory items associated with this task
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('items')
          .select('*')
          .eq('associated_task_id', id);
          
        if (inventoryError) console.error('Error fetching inventory items:', inventoryError);
        else setInventoryItems(inventoryData || []);
        
      } catch (err) {
        console.error('Error fetching task details:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while loading the task');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchTask();
  }, [id, user]);
  
  const handleDelete = async () => {
    if (!task || !user) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);
        
      if (error) throw error;
      
      // Navigate back to tasks list or project tasks
      if (task.is_project_task && task.project_id) {
        navigate(`/projects/${task.project_id}/tasks`);
      } else {
        navigate('/tasks');
      }
      
    } catch (err) {
      console.error('Error deleting task:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while deleting the task');
      }
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Mark task as complete
  const handleMarkComplete = async () => {
    if (!task || !user) return;
    
    setUpdatingStatus(true);
    try {
      // Update the task status to done
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
        
      if (error) throw error;
      
      // Update the local state
      setTask({
        ...task,
        status: 'done'
      });
      
    } catch (err) {
      console.error('Error updating task status:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while updating the task status');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Get priority color
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
  
  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'done':
        return 'Done';
      case 'blocked':
        return 'Blocked';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/tasks')}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Tasks
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        Task not found. It may have been deleted or you don't have access.
      </div>
    );
  }

  // Format date for display
  const formattedDueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
    
  const formattedCreatedDate = new Date(task.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center">
              <AlertCircle className="h-6 w-6 mr-2" />
              Delete Task
            </h3>
            <p className="mb-4">Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
              <CheckSquare className="h-6 w-6 mr-2 text-green-600" />
              {task.title}
            </h1>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
                {formatStatus(task.status)}
              </span>
              
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Link
              to={`/tasks/edit/${task.id}`}
              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            >
              <Edit className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white p-2 rounded hover:bg-red-700"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Complete Task Button */}
        {task.status !== 'done' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-green-800 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Mark Task as Complete
                </h3>
                <p className="text-green-700 text-sm mt-1">
                  Have you finished this task? Mark it as complete to track your progress.
                </p>
              </div>
              <button
                onClick={handleMarkComplete}
                disabled={updatingStatus}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300 flex items-center"
              >
                {updatingStatus ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Task
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {task.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Description</h2>
            <p className="text-gray-600 whitespace-pre-line">{task.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Details</h2>
            
            <div className="space-y-3">
              {formattedDueDate && (
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Due Date</p>
                    <p className="text-gray-700">{formattedDueDate}</p>
                  </div>
                </div>
              )}
              
              {task.is_project_task && projectName && (
                <div className="flex items-start">
                  <Folder className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <Link 
                      to={`/projects/${task.project_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {projectName}
                    </Link>
                  </div>
                </div>
              )}
              
              <div className="flex items-start">
                <User className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="text-gray-700">{assigneeName || 'Not assigned'}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Clock className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Created On</p>
                  <p className="text-gray-700">{formattedCreatedDate}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-700">Related Inventory</h2>
              <Link 
                to={`/inventory/new?task_id=${task.id}`}
                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Link>
            </div>
            
            {inventoryItems.length > 0 ? (
              <div className="space-y-3">
                {inventoryItems.map(item => (
                  <Link
                    key={item.id}
                    to={`/inventory/${item.id}`}
                    className="block bg-white p-3 rounded border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start">
                      <Package className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-800">{item.title}</p>
                        <p className="text-sm text-gray-600 line-clamp-1">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No inventory items associated with this task.</p>
            )}
          </div>
        </div>
        
        <div className="flex justify-between mt-8">
          <Link
            to="/tasks"
            className="text-blue-600 hover:underline flex items-center"
          >
            ← Back to All Tasks
          </Link>
          
          {task.is_project_task && task.project_id && (
            <Link
              to={`/projects/${task.project_id}/tasks`}
              className="text-blue-600 hover:underline flex items-center"
            >
              Back to Project Tasks
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;