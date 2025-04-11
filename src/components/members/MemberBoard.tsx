import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { 
  Users, 
  Search, 
  UserPlus, 
  Mail, 
  Folder, 
  CheckSquare, 
  Package, 
  X, 
  Loader2,
  UserCheck,
  UserX,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

const MemberBoard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  
  // Assignment states
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [assigningToProject, setAssigningToProject] = useState<string | null>(null);
  const [assigningToTask, setAssigningToTask] = useState<string | null>(null);
  
  // Member's assigned content
  const [memberProjects, setMemberProjects] = useState<Project[]>([]);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [memberItems, setMemberItems] = useState<Item[]>([]);
  const [loadingMemberContent, setLoadingMemberContent] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loadingAllProfiles, setLoadingAllProfiles] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Fetch user's projects, tasks, and items for assignment
  useEffect(() => {
    if (!user) return;
    
    const fetchUserContent = async () => {
      setLoadingProjects(true);
      setLoadingTasks(true);
      setLoadingItems(true);
      
      try {
        // Fetch projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('created_by', user.id)
          .order('updated_at', { ascending: false });
          
        if (projectsError) throw projectsError;
        setProjects(projectsData || []);
        
        // Fetch tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('created_by', user.id)
          .order('updated_at', { ascending: false });
          
        if (tasksError) throw tasksError;
        setTasks(tasksData || []);
        
        // Fetch items
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('added_by', user.id)
          .order('updated_at', { ascending: false });
          
        if (itemsError) throw itemsError;
        setItems(itemsData || []);
        
        // Fetch all profiles for easier searching
        fetchAllProfiles();
        
      } catch (err) {
        console.error('Error fetching user content:', err);
        setError('Failed to load your content for assignment');
      } finally {
        setLoadingProjects(false);
        setLoadingTasks(false);
        setLoadingItems(false);
      }
    };
    
    fetchUserContent();
  }, [user]);

  // Fetch all profiles for local searching
  const fetchAllProfiles = async () => {
    if (!user) return;
    
    setLoadingAllProfiles(true);
    setDebugInfo('Fetching all profiles...');
    
    try {
      // Direct query to get all profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
        
      if (error) {
        setDebugInfo(`Error fetching profiles: ${error.message}`);
        throw error;
      }
      
      // Filter out the current user
      const filteredProfiles = data?.filter(profile => profile.user_id !== user.id) || [];
      setAllProfiles(filteredProfiles);
      
      const emailList = filteredProfiles.map(p => p.email).join(', ');
      setDebugInfo(`Found ${filteredProfiles.length} profiles. Emails: ${emailList}`);
      
    } catch (err) {
      console.error('Error fetching all profiles:', err);
      if (err instanceof Error) {
        setDebugInfo(`Error: ${err.message}`);
      }
    } finally {
      setLoadingAllProfiles(false);
    }
  };

  // Search for members by email
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setDebugInfo(`Searching for: ${searchQuery.trim()}`);
    
    try {
      // Direct database query with no caching
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', `%${searchQuery.trim()}%`);
        
      if (error) {
        setDebugInfo(`Search error: ${error.message}`);
        throw error;
      }
      
      // Filter out the current user
      const filteredResults = data?.filter(profile => profile.user_id !== user.id) || [];
      
      setSearchResults(filteredResults);
      setDebugInfo(`Search found ${filteredResults.length} results`);
      
      if (filteredResults.length === 0) {
        setError('No members found with that email address. Try showing all members or check the email spelling.');
      }
      
    } catch (err) {
      console.error('Error searching for members:', err);
      setError('Failed to search for members');
    } finally {
      setIsSearching(false);
    }
  };

  // Show all available members
  const showAllMembers = async () => {
    setIsSearching(true);
    setError(null);
    setDebugInfo('Loading all members...');
    
    try {
      // Direct query to get all profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
        
      if (error) {
        setDebugInfo(`Error loading all members: ${error.message}`);
        throw error;
      }
      
      // Filter out the current user
      const filteredProfiles = data?.filter(profile => profile.user_id !== user.id) || [];
      
      // Update both the search results and the cached profiles
      setSearchResults(filteredProfiles);
      setAllProfiles(filteredProfiles);
      
      const emailList = filteredProfiles.map(p => p.email).join(', ');
      setDebugInfo(`Found ${filteredProfiles.length} members. Emails: ${emailList}`);
      
      if (filteredProfiles.length === 0) {
        setError('No other members found in the system');
      } else {
        setSuccess(`Showing all ${filteredProfiles.length} members`);
      }
    } catch (err) {
      console.error('Error fetching all profiles:', err);
      setError('Failed to load all members');
    } finally {
      setIsSearching(false);
    }
  };

  // Select a member to view/assign
  const handleSelectMember = async (member: Profile) => {
    setSelectedMember(member);
    setLoadingMemberContent(true);
    
    try {
      // Fetch member's projects (where they are in the team array)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .contains('team', [member.user_id])
        .order('updated_at', { ascending: false });
        
      if (projectsError) throw projectsError;
      setMemberProjects(projectsData || []);
      
      // Fetch member's tasks (where they are assigned)
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*, projects(title)')
        .eq('assigned_to', member.user_id)
        .order('updated_at', { ascending: false });
        
      if (tasksError) throw tasksError;
      setMemberTasks(tasksData || []);
      
      // Fetch member's items (where they added them)
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*, projects(title)')
        .eq('added_by', member.user_id)
        .order('updated_at', { ascending: false });
          
      if (itemsError) throw itemsError;
      setMemberItems(itemsData || []);
      
    } catch (err) {
      console.error('Error fetching member content:', err);
      setError('Failed to load member\'s content');
    } finally {
      setLoadingMemberContent(false);
    }
  };

  // Assign member to a project
  const handleAssignToProject = async (projectId: string) => {
    if (!selectedMember || !user) return;
    
    setAssigningToProject(projectId);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the current project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('team, title')
        .eq('id', projectId)
        .single();
        
      if (projectError) throw projectError;
      
      // Check if member is already in the team
      const team = project.team || [];
      if (team.includes(selectedMember.user_id)) {
        setError(`${selectedMember.name} is already a member of this project`);
        return;
      }
      
      // Add member to the team array
      const updatedTeam = [...team, selectedMember.user_id];
      
      // Update the project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          team: updatedTeam,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setProjects(prevProjects => 
        prevProjects.map(p => 
          p.id === projectId 
            ? { ...p, team: updatedTeam } 
            : p
        )
      );
      
      // Add to member's projects
      const projectToAdd = projects.find(p => p.id === projectId);
      if (projectToAdd) {
        setMemberProjects(prev => [...prev, projectToAdd]);
      }
      
      setSuccess(`${selectedMember.name} has been added to project: ${project.title}`);
      
    } catch (err) {
      console.error('Error assigning to project:', err);
      setError('Failed to assign member to project');
    } finally {
      setAssigningToProject(null);
    }
  };

  // Assign member to a task
  const handleAssignToTask = async (taskId: string) => {
    if (!selectedMember || !user) return;
    
    setAssigningToTask(taskId);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the current task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('title, assigned_to')
        .eq('id', taskId)
        .single();
        
      if (taskError) throw taskError;
      
      // Check if task is already assigned to someone else
      if (task.assigned_to && task.assigned_to !== selectedMember.user_id) {
        // Confirm reassignment
        if (!window.confirm('This task is already assigned to someone else. Do you want to reassign it?')) {
          return;
        }
      }
      
      // Update the task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          assigned_to: selectedMember.user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId 
            ? { ...t, assigned_to: selectedMember.user_id } 
            : t
        )
      );
      
      // Add to member's tasks
      const taskToAdd = tasks.find(t => t.id === taskId);
      if (taskToAdd) {
        setMemberTasks(prev => [...prev, { ...taskToAdd, assigned_to: selectedMember.user_id }]);
      }
      
      setSuccess(`${selectedMember.name} has been assigned to task: ${task.title}`);
      
    } catch (err) {
      console.error('Error assigning to task:', err);
      setError('Failed to assign member to task');
    } finally {
      setAssigningToTask(null);
    }
  };

  // Remove member from a project
  const handleRemoveFromProject = async (projectId: string) => {
    if (!selectedMember || !user) return;
    
    setAssigningToProject(projectId);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the current project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('team, title')
        .eq('id', projectId)
        .single();
        
      if (projectError) throw projectError;
      
      // Remove member from the team
      const team = project.team || [];
      const updatedTeam = team.filter(id => id !== selectedMember.user_id);
      
      // Update the project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          team: updatedTeam,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setMemberProjects(prev => prev.filter(p => p.id !== projectId));
      
      setSuccess(`${selectedMember.name} has been removed from project: ${project.title}`);
      
    } catch (err) {
      console.error('Error removing from project:', err);
      setError('Failed to remove member from project');
    } finally {
      setAssigningToProject(null);
    }
  };

  // Unassign member from a task
  const handleUnassignTask = async (taskId: string) => {
    if (!selectedMember || !user) return;
    
    setAssigningToTask(taskId);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the current task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', taskId)
        .single();
        
      if (taskError) throw taskError;
      
      // Update the task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setMemberTasks(prev => prev.filter(t => t.id !== taskId));
      
      setSuccess(`${selectedMember.name} has been unassigned from task: ${task.title}`);
      
    } catch (err) {
      console.error('Error unassigning task:', err);
      setError('Failed to unassign member from task');
    } finally {
      setAssigningToTask(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Users className="h-6 w-6 mr-2 text-blue-600" />
        Member Board
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Debug Info */}
      {debugInfo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span>Debug Info: {debugInfo}</span>
            <button onClick={() => setDebugInfo('')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <h2 className="text-lg font-semibold text-gray-700">Search for Members</h2>
        </div>
        <div className="flex">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email address..."
              className="w-full pl-10 pr-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={showAllMembers}
            className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 flex items-center"
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Show All Members
          </button>
          
          <button
            onClick={fetchAllProfiles}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center"
            disabled={loadingAllProfiles}
            title="Refresh profile data"
          >
            {loadingAllProfiles ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Profiles
          </button>
        </div>
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Search Results ({searchResults.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map(member => (
              <div 
                key={member.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectMember(member)}
              >
                <div className="flex items-center mb-2">
                  {member.avatar_url ? (
                    <img 
                      src={member.avatar_url} 
                      alt={member.name} 
                      className="w-10 h-10 rounded-full mr-3 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-medium">
                        {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-800">{member.name || 'Unnamed User'}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectMember(member);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Selected Member */}
      {selectedMember && (
        <div className="mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              {selectedMember.avatar_url ? (
                <img 
                  src={selectedMember.avatar_url} 
                  alt={selectedMember.name} 
                  className="w-16 h-16 rounded-full mr-4 object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold text-xl">
                    {selectedMember.name?.charAt(0) || selectedMember.email?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedMember.name || 'Unnamed User'}</h2>
                <p className="text-gray-600">{selectedMember.email}</p>
                {selectedMember.location && (
                  <p className="text-sm text-gray-500">{selectedMember.location}</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assign to Projects */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <Folder className="h-5 w-5 mr-2 text-blue-600" />
                Assign to Projects
              </h3>
              
              {loadingProjects ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 mb-4">You don't have any projects to assign members to.</p>
                  <Link
                    to="/projects/new"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Project
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {projects.map(project => (
                    <div key={project.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-800">{project.title}</h4>
                          {project.location && (
                            <p className="text-sm text-gray-500">{project.location}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAssignToProject(project.id)}
                          disabled={assigningToProject === project.id}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                        >
                          {assigningToProject === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Assign to Tasks */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <CheckSquare className="h-5 w-5 mr-2 text-green-600" />
                Assign to Tasks
              </h3>
              
              {loadingTasks ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 mb-4">You don't have any tasks to assign members to.</p>
                  <Link
                    to="/tasks/new"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Task
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {tasks.map(task => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-800">{task.title}</h4>
                          <p className="text-xs text-gray-500">
                            Status: {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            {task.due_date && ` • Due: ${formatDate(task.due_date)}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssignToTask(task.id)}
                          disabled={assigningToTask === task.id}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-green-300 flex items-center"
                        >
                          {assigningToTask === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Member's Assigned Content */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {selectedMember.name}'s Assignments
            
            </h3>
            
            {loadingMemberContent ? (
              <div className="flex justify-center py-8">
                <Loader2  className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) :
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Member's Projects */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <Folder className="h-5 w-5 mr-2 text-blue-600" />
                    Projects ({memberProjects.length})
                  </h4>
                  
                  {memberProjects.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">
                        {selectedMember.name} is not assigned to any projects.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {memberProjects.map(project => (
                        <div key={project.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link 
                                to={`/projects/${project.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {project.title}
                              </Link>
                              {project.location && (
                                <p className="text-sm text-gray-500">{project.location}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveFromProject(project.id)}
                              disabled={assigningToProject === project.id}
                              className="text-red-600 hover:text-red-800 p-1 rounded"
                              title="Remove from project"
                            >
                              {assigningToProject === project.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Member's Tasks */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <CheckSquare className="h-5 w-5 mr-2 text-green-600" />
                    Assigned Tasks ({memberTasks.length})
                  </h4>
                  
                  {memberTasks.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">
                        {selectedMember.name} is not assigned to any tasks.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {memberTasks.map(task => (
                        <div key={task.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link 
                                to={`/tasks/${task.id}`}
                                className="font-medium text-green-600 hover:underline"
                              >
                                {task.title}
                              </Link>
                              <p className="text-xs text-gray-500">
                                Status: {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                {task.due_date && ` • Due: ${formatDate(task.due_date)}`}
                              </p>
                              {task.projects && (
                                <p className="text-xs text-gray-500">
                                  Project: {(task.projects as any).title}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleUnassignTask(task.id)}
                              disabled={assigningToTask === task.id}
                              className="text-red-600 hover:text-red-800 p-1 rounded"
                              title="Unassign task"
                            >
                              {assigningToTask === task.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Member's Items */}
                <div className="border border-gray-200 rounded-lg p-4 lg:col-span-2">
                  <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-yellow-600" />
                    Inventory Items ({memberItems.length})
                  </h4>
                  
                  {memberItems.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">
                        {selectedMember.name} has not added any inventory items.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                      {memberItems.map(item => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                          <Link 
                            to={`/inventory/${item.id}`}
                            className="font-medium text-yellow-600 hover:underline"
                          >
                            {item.title}
                          </Link>
                          <p className="text-xs text-gray-500">
                            Type: {item.item_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          {item.projects && (
                            <p className="text-xs text-gray-500">
                              Project: {(item.projects as any).title}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            }
          </div>
        </div>
      )}
      
      {/* No search results state */}
      {searchQuery && searchResults.length === 0 && !isSearching && !error && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No members found</h3>
          <p className="text-gray-500 mb-4">Try searching with a different email address</p>
        </div>
      )}
      
      {/* Empty state */}
      {!searchQuery && !selectedMember && searchResults.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Find Team Members</h3>
          <p className="text-gray-500 mb-4">Search for members by email address to assign them to your projects and tasks</p>
          <button
            onClick={showAllMembers}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Users className="h-4 w-4 mr-2" />
            Show All Members
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberBoard;