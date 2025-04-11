import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { CheckSquare, Calendar, AlertCircle, Clock, Folder, Save, User, ArrowLeft } from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

const TaskEditForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'done' | 'blocked'>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isProjectTask, setIsProjectTask] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);

  // Fetch task data
  useEffect(() => {
    if (!id || !user) return;
    
    const fetchTask = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          setError('Task not found');
          return;
        }
        
        // Set form values from task data
        setTitle(data.title);
        setDescription(data.description || '');
        setStatus(data.status);
        setPriority(data.priority);
        setDueDate(data.due_date ? new Date(data.due_date).toISOString().split('T')[0] : '');
        setIsProjectTask(data.is_project_task);
        setProjectId(data.project_id || '');
        setAssignedTo(data.assigned_to || user.id);
        
        // If task is associated with a project, fetch project details
        if (data.project_id) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', data.project_id)
            .single();
            
          if (!projectError && projectData) {
            setProjectDetails(projectData);
          }
        }
        
      } catch (err) {
        console.error('Error fetching task:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while loading the task');
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch user's projects
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .or(`created_by.eq.${user.id},team.cs.{${user.id}}`)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        setProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    
    fetchTask();
    fetchProjects();
  }, [id, user]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Task data
      const taskData = {
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate || null,
        is_project_task: isProjectTask,
        project_id: isProjectTask && projectId ? projectId : null,
        assigned_to: assignedTo || user.id,
        updated_at: new Date().toISOString(),
      };
      
      // Update task in database
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', id);
        
      if (error) throw error;
      
      setSuccess('Task updated successfully!');
      
      // Navigate to appropriate page after success
      setTimeout(() => {
        if (isProjectTask && projectId) {
          navigate(`/projects/${projectId}/tasks`);
        } else {
          navigate('/tasks');
        }
      }, 1500);
      
    } catch (err) {
      console.error('Error updating task:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while updating the task');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error && loading) {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Back link to project if task is associated with a project */}
      {projectDetails && (
        <div className="mb-6">
          <Link 
            to={`/projects/${projectDetails.id}`}
            className="text-blue-600 hover:underline mb-4 inline-flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {projectDetails.title}
          </Link>
        </div>
      )}
      
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <CheckSquare className="h-6 w-6 mr-2 text-green-600" />
        Edit Task
        {projectDetails && (
          <span className="ml-2 text-lg text-gray-500">for {projectDetails.title}</span>
        )}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="title">
            Task Title *
          </label>
          <input
            id="title"
            type="text"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task description (optional)"
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="status">
              Status *
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <select
                id="status"
                className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                required
              >
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
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="priority">
              Priority *
            </label>
            <div className="relative">
              <AlertCircle className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <select
                id="priority"
                className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="dueDate">
            Due Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              id="dueDate"
              type="date"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <input
              id="isProjectTask"
              type="checkbox"
              className="h-4 w-4 text-green-500 focus:ring-green-400 border-gray-300 rounded"
              checked={isProjectTask}
              onChange={(e) => {
                setIsProjectTask(e.target.checked);
                if (!e.target.checked) {
                  setProjectId('');
                }
              }}
            />
            <label className="ml-2 block text-gray-700 text-sm font-medium" htmlFor="isProjectTask">
              This is a project task
            </label>
          </div>
          
          {isProjectTask && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="projectId">
                Associated Project *
              </label>
              <div className="relative">
                <Folder className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <select
                  id="projectId"
                  className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    const selectedProject = projects.find(p => p.id === e.target.value);
                    setProjectDetails(selectedProject || null);
                  }}
                  required={isProjectTask}
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {projects.length === 0 && (
                <p className="text-sm text-amber-600 mt-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  You don't have any projects yet. Create a project first to assign this task.
                </p>
              )}
              
              {projectId && (
                <div className="mt-2 text-sm text-green-600">
                  This task will be associated with the selected project.
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="assignedTo">
            Assigned To
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <select
              id="assignedTo"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value={user?.id}>Me</option>
              {/* In a real app, you would fetch team members and show them here */}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            type="submit"
            className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
            disabled={saving}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Save Changes
              </>
            )}
          </button>
          
          <button
            type="button"
            className="bg-gray-200 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskEditForm;