import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Database } from '../../types/supabase';
import { CheckSquare, Plus, Calendar, Clock, Filter, Search, AlertCircle, ListFilter, CheckCircle } from 'lucide-react';
import TaskCard from './TaskCard';

type Task = Database['public']['Tables']['tasks']['Row'];

const TasksList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      try {
        // Fetch tasks where the user is either the creator or the assignee
        const { data, error } = await supabase
          .from('tasks')
          .select('*, projects(title)')
          .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
          .order('due_date', { ascending: true })
          .order('priority', { ascending: false });

        if (error) {
          console.error('Error fetching tasks:', error);
          setError('Could not load tasks');
        } else {
          setTasks(data || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user]);

  // Filter tasks based on selected filters and search query
  const filteredTasks = tasks.filter(task => {
    // Apply status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }
    
    // Apply type filter (personal or project tasks)
    if (typeFilter === 'personal' && task.is_project_task) {
      return false;
    }
    if (typeFilter === 'project' && !task.is_project_task) {
      return false;
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <CheckSquare className="h-6 w-6 mr-2 text-green-600" />
          Tasks
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              className="pl-10 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Link
            to="/tasks/new"
            className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-1" />
            New Task
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
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
        
        <div className="relative">
          <AlertCircle className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <select
            className="pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
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
        
        <div className="relative">
          <ListFilter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <select
            className="pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Tasks</option>
            <option value="personal">Personal Tasks</option>
            <option value="project">Project Tasks</option>
          </select>
          <div className="absolute right-3 top-3 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No tasks yet</h2>
          <p className="text-gray-500 mb-6">Get started by creating your first task</p>
          <Link
            to="/tasks/new"
            className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors text-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Task
          </Link>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No matching tasks</h2>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setTypeFilter('all');
            }}
            className="inline-flex items-center bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear Filters
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

export default TasksList;