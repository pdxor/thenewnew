import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { UserCircle, MapPin, Code, Flag, CalendarClock, Folder, CheckSquare, Package, Plus, Search, Calendar, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProfileSetupForm from './ProfileSetupForm';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [assignedContentLoading, setAssignedContentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'inventory' | 'assigned'>('projects');

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        // Modified query to handle the case where no profile exists
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(); // Using maybeSingle() instead of single() to handle the no-rows case

        if (fetchError) {
          console.error('Error fetching profile:', fetchError);
          setError('Could not load profile information');
        } else {
          // data will be null if no profile exists
          setProfile(data);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Fetch user's projects
    const fetchProjects = async () => {
      try {
        setProjectsLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .or(`created_by.eq.${user.id},team.cs.{${user.id}}`)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        setProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setProjectsLoading(false);
      }
    };
    
    // Fetch user's tasks
    const fetchTasks = async () => {
      try {
        setTasksLoading(true);
        const { data, error } = await supabase
          .from('tasks')
          .select('*, projects(title)')
          .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
          .order('due_date', { ascending: true })
          .order('priority', { ascending: false })
          .limit(5);
          
        if (error) throw error;
        
        setTasks(data || []);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      } finally {
        setTasksLoading(false);
      }
    };
    
    // Fetch user's inventory items
    const fetchItems = async () => {
      try {
        setItemsLoading(true);
        const { data, error } = await supabase
          .from('items')
          .select('*, projects(title)')
          .eq('added_by', user.id)
          .order('updated_at', { ascending: false })
          .limit(5);
          
        if (error) throw error;
        
        setItems(data || []);
      } catch (err) {
        console.error('Error fetching inventory items:', err);
      } finally {
        setItemsLoading(false);
      }
    };
    
    // Fetch projects where user is a team member but not creator
    const fetchAssignedProjects = async () => {
      try {
        setAssignedContentLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .contains('team', [user.id])
          .not('created_by', 'eq', user.id)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        setAssignedProjects(data || []);
      } catch (err) {
        console.error('Error fetching assigned projects:', err);
      }
    };
    
    // Fetch tasks assigned to user but not created by user
    const fetchAssignedTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            *,
            projects(title),
            creator:profiles!tasks_created_by_fkey(name)
          `)
          .eq('assigned_to', user.id)
          .not('created_by', 'eq', user.id)
          .order('due_date', { ascending: true })
          .order('priority', { ascending: false });
          
        if (error) throw error;
        
        setAssignedTasks(data || []);
      } catch (err) {
        console.error('Error fetching assigned tasks:', err);
      } finally {
        setAssignedContentLoading(false);
      }
    };

    fetchProfile();
    fetchProjects();
    fetchTasks();
    fetchItems();
    fetchAssignedProjects();
    fetchAssignedTasks();
  }, [user]);

  // Get status color for tasks
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

  // Format task status for display
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

  // Get item type color
  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'needed_supply':
        return 'bg-yellow-100 text-yellow-800';
      case 'owned_resource':
        return 'bg-green-100 text-green-800';
      case 'borrowed_or_rental':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Format item type for display
  const formatItemType = (type: string) => {
    switch (type) {
      case 'needed_supply':
        return 'Needed Supply';
      case 'owned_resource':
        return 'Owned Resource';
      case 'borrowed_or_rental':
        return 'Borrowed/Rental';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  // If no profile exists, show the profile setup form
  if (!profile) {
    return <ProfileSetupForm />;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-green-700 h-32 relative"></div>
        
        <div className="px-6 py-4 relative">
          <div className="absolute -top-16 left-6 bg-white p-1 rounded-full">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-32 h-32 rounded-full object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                <UserCircle className="h-20 w-20 text-gray-400" />
              </div>
            )}
          </div>
          
          <div className="mt-16 flex flex-col md:flex-row md:justify-between md:items-start">
            <div className="mb-6 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-800">{profile.name}</h1>
              
              <div className="flex items-center text-gray-500 mt-1">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{profile.location || 'No location set'}</span>
              </div>
              
              <div className="flex items-center text-gray-500 mt-1">
                <CalendarClock className="h-4 w-4 mr-1" />
                <span>Joined {new Date(profile.joined_at).toLocaleDateString()}</span>
              </div>
              
              <div className="mt-4">
                <Link 
                  to="/profile/edit" 
                  className="text-blue-600 hover:underline text-sm"
                >
                  Edit Profile
                </Link>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {profile.skills && profile.skills.length > 0 && profile.skills.map((skill, index) => (
                <span 
                  key={index}
                  className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm flex items-center"
                >
                  <Code className="h-3 w-3 mr-1" />
                  {skill}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {profile.short_term_mission && (
              <div>
                <h3 className="text-md font-medium text-gray-600 flex items-center">
                  <Flag className="h-4 w-4 mr-1" />
                  Short-term Mission
                </h3>
                <p className="text-gray-700 mt-1">
                  {profile.short_term_mission}
                </p>
              </div>
            )}
            
            {profile.long_term_mission && (
              <div>
                <h3 className="text-md font-medium text-gray-600 flex items-center">
                  <Flag className="h-4 w-4 mr-1" />
                  Long-term Mission
                </h3>
                <p className="text-gray-700 mt-1">
                  {profile.long_term_mission}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Activity Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex flex-wrap">
            <button
              className={`py-4 px-6 text-sm font-medium flex items-center ${
                activeTab === 'projects' 
                  ? 'border-b-2 border-green-600 text-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('projects')}
            >
              <Folder className="h-4 w-4 mr-2" />
              Projects ({projects.length})
            </button>
            <button
              className={`py-4 px-6 text-sm font-medium flex items-center ${
                activeTab === 'tasks' 
                  ? 'border-b-2 border-green-600 text-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('tasks')}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Tasks ({tasks.length})
            </button>
            <button
              className={`py-4 px-6 text-sm font-medium flex items-center ${
                activeTab === 'inventory' 
                  ? 'border-b-2 border-green-600 text-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package className="h-4 w-4 mr-2" />
              Inventory ({items.length})
            </button>
            <button
              className={`py-4 px-6 text-sm font-medium flex items-center ${
                activeTab === 'assigned' 
                  ? 'border-b-2 border-green-600 text-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('assigned')}
            >
              <Users className="h-4 w-4 mr-2" />
              Assigned ({assignedProjects.length + assignedTasks.length})
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Projects Tab Content */}
          {activeTab === 'projects' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Folder className="h-5 w-5 mr-2 text-blue-600" />
                  My Projects
                </h2>
                <Link 
                  to="/projects/new"
                  className="bg-green-600 text-white text-sm py-1 px-3 rounded hover:bg-green-700 inline-flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Project
                </Link>
              </div>
              
              {projectsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No projects yet</h3>
                  <p className="text-gray-500 mb-4">Start your sustainability journey by creating your first project.</p>
                  <Link
                    to="/projects/new"
                    className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Project
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.slice(0, 6).map(project => (
                      <Link key={project.id} to={`/projects/${project.id}`} className="block">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium text-gray-800">{project.title}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              project.property_status === 'owned_land' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {project.property_status === 'owned_land' ? 'Owned' : 'Potential'}
                            </span>
                          </div>
                          
                          {project.location && (
                            <div className="text-gray-600 text-sm mb-2 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {project.location}
                            </div>
                          )}
                          
                          {project.category && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full mt-1">
                              {project.category}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {projects.length > 6 && (
                    <div className="mt-4 text-center">
                      <Link to="/projects" className="text-blue-600 hover:underline">
                        See all projects ({projects.length})
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Tasks Tab Content */}
          {activeTab === 'tasks' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <CheckSquare className="h-5 w-5 mr-2 text-green-600" />
                  My Tasks
                </h2>
                <Link 
                  to="/tasks/new"
                  className="bg-green-600 text-white text-sm py-1 px-3 rounded hover:bg-green-700 inline-flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Task
                </Link>
              </div>
              
              {tasksLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 mb-4">Get organized by creating your first task.</p>
                  <Link
                    to="/tasks/new"
                    className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Task
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <Link key={task.id} to={`/tasks/${task.id}`} className="block">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium text-gray-800">{task.title}</h3>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                                {formatStatus(task.status)}
                              </span>
                            </div>
                          </div>
                          
                          {task.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <div>
                              {task.due_date && (
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            
                            {task.projects && (
                              <span className="flex items-center">
                                <Folder className="h-3 w-3 mr-1" />
                                {(task.projects as any).title}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {tasks.length > 5 && (
                    <div className="mt-4 text-center">
                      <Link to="/tasks" className="text-blue-600 hover:underline">
                        See all tasks
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Inventory Tab Content */}
          {activeTab === 'inventory' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-green-600" />
                  My Inventory
                </h2>
                <Link 
                  to="/inventory/new"
                  className="bg-green-600 text-white text-sm py-1 px-3 rounded hover:bg-green-700 inline-flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Link>
              </div>
              
              {itemsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No inventory items yet</h3>
                  <p className="text-gray-500 mb-4">Start tracking project resources by adding inventory items.</p>
                  <Link
                    to="/inventory/new"
                    className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => (
                      <Link key={item.id} to={`/inventory/${item.id}`} className="block">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium text-gray-800 line-clamp-2">{item.title}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${getItemTypeColor(item.item_type)}`}>
                              {formatItemType(item.item_type)}
                            </span>
                          </div>
                          
                          {item.description && (
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">{item.description}</p>
                          )}
                          
                          {item.projects && (
                            <div className="text-xs text-gray-500 flex items-center">
                              <Folder className="h-3 w-3 mr-1" />
                              {(item.projects as any).title}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {items.length > 6 && (
                    <div className="mt-4 text-center">
                      <Link to="/inventory" className="text-blue-600 hover:underline">
                        See all inventory items
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Assigned Content Tab */}
          {activeTab === 'assigned' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-purple-600" />
                  Assigned to Me
                </h2>
                <Link 
                  to="/members"
                  className="bg-purple-600 text-white text-sm py-1 px-3 rounded hover:bg-purple-700 inline-flex items-center"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Member Board
                </Link>
              </div>
              
              {assignedContentLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : assignedProjects.length === 0 && assignedTasks.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No assigned content</h3>
                  <p className="text-gray-500 mb-4">You haven't been assigned to any projects or tasks yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Assigned Projects */}
                  {assignedProjects.length > 0 && (
                    <div>
                      <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                        <Folder className="h-4 w-4 mr-2 text-blue-600" />
                        Projects ({assignedProjects.length})
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assignedProjects.map(project => (
                          <Link key={project.id} to={`/projects/${project.id}`} className="block">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-gray-800">{project.title}</h3>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  project.property_status === 'owned_land' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {project.property_status === 'owned_land' ? 'Owned' : 'Potential'}
                                </span>
                              </div>
                              
                              {project.location && (
                                <div className="text-gray-600 text-sm mb-2 flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {project.location}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Assigned Tasks */}
                  {assignedTasks.length > 0 && (
                    <div>
                      <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                        <CheckSquare className="h-4 w-4 mr-2 text-green-600" />
                        Tasks ({assignedTasks.length})
                      </h3>
                      
                      <div className="space-y-3">
                        {assignedTasks.map(task => (
                          <Link key={task.id} to={`/tasks/${task.id}`} className="block">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="font-medium text-gray-800">{task.title}</h3>
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                                    {formatStatus(task.status)}
                                  </span>
                                </div>
                              </div>
                              
                              {task.description && (
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.description}</p>
                              )}
                              
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <div className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  <span>
                                    Assigned by: {(task.creator as any)?.name || 'Unknown'}
                                  </span>
                                </div>
                                
                                {task.projects && (
                                  <span className="flex items-center">
                                    <Folder className="h-3 w-3 mr-1" />
                                    {(task.projects as any).title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;