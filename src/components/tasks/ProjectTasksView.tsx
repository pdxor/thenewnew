import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Database } from '../../types/supabase';
import { CheckSquare, Plus, Filter, ArrowLeft, Folder } from 'lucide-react';
import TaskCard from './TaskCard';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

const ProjectTasksView: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;

    const fetchProjectAndTasks = async () => {
      try {
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
          
        if (projectError) throw projectError;
        
        if (!projectData) {
          setError('Project not found');
          return;
        }
        
        setProject(projectData);
        
        // Fetch tasks for this project
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('due_date', { ascending: true })
          .order('priority', { ascending: false });
          
        if (tasksError) throw tasksError;
        
        setTasks(tasksData || []);
      } catch (err) {
        console.error('Error fetching project tasks:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while loading project tasks');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndTasks();
  }, [projectId, user]);

  // Filter tasks based on selected status filter
  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all') {
      return task.status === statusFilter;
    }
    return true;
  });

  // Group tasks by status
  const todoTasks = filteredTasks.filter(task => task.status === 'todo');
  const inProgressTasks = filteredTasks.filter(task => task.status === 'in_progress');
  const doneTasks = filteredTasks.filter(task => task.status === 'done');
  const blockedTasks = filteredTasks.filter(task => task.status === 'blocked');

  // Mark task as complete
  const handleMarkComplete = async (taskId: string) => {
    if (!user) return;
    
    setUpdatingTaskId(taskId);
    try {
      // Update the task status to done
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Update the local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: 'done' } 
            : task
        )
      );
      
    } catch (err) {
      console.error('Error updating task status:', err);
      setError('Failed to update task status');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error || 'Project not found'}</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/projects')}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          to={`/projects/${projectId}`}
          className="text-blue-600 hover:underline mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Project
        </Link>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-3">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Folder className="h-6 w-6 mr-2 text-blue-600" />
            {project.title}: Tasks
          </h1>
          
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                className="pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            <Link
              to={`/tasks/new?project_id=${projectId}`}
              className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-1" />
              New Task
            </Link>
          </div>
        </div>
      </div>
      
      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No tasks for this project yet</h2>
          <p className="text-gray-500 mb-6">Start organizing your project by creating tasks</p>
          <Link
            to={`/tasks/new?project_id=${projectId}`}
            className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors text-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Task
          </Link>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No tasks match the selected filter</h2>
          <p className="text-gray-500 mb-4">Try selecting a different status filter</p>
          <button
            onClick={() => setStatusFilter('all')}
            className="inline-flex items-center bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Show All Tasks
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* To Do Column */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              To Do ({todoTasks.length})
            </h2>
            <div className="space-y-4">
              {todoTasks.map(task => (
                <Link key={task.id} to={`/tasks/${task.id}`}>
                  <TaskCard 
                    task={task} 
                    onMarkComplete={handleMarkComplete}
                  />
                </Link>
              ))}
            </div>
          </div>
          
          {/* In Progress Column */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
              In Progress ({inProgressTasks.length})
            </h2>
            <div className="space-y-4">
              {inProgressTasks.map(task => (
                <Link key={task.id} to={`/tasks/${task.id}`}>
                  <TaskCard 
                    task={task} 
                    onMarkComplete={handleMarkComplete}
                  />
                </Link>
              ))}
            </div>
          </div>
          
          {/* Done Column */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Done ({doneTasks.length})
            </h2>
            <div className="space-y-4">
              {doneTasks.map(task => (
                <Link key={task.id} to={`/tasks/${task.id}`}>
                  <TaskCard task={task} />
                </Link>
              ))}
            </div>
          </div>
          
          {/* Blocked Column */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Blocked ({blockedTasks.length})
            </h2>
            <div className="space-y-4">
              {blockedTasks.map(task => (
                <Link key={task.id} to={`/tasks/${task.id}`}>
                  <TaskCard 
                    task={task} 
                    onMarkComplete={handleMarkComplete}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTasksView;