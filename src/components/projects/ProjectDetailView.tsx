import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  MapPin, 
  Users, 
  CalendarClock, 
  Edit, 
  Trash2,
  CircleDot,
  Droplets,
  Sprout,
  Zap,
  Building2,
  Target,
  AlertTriangle,
  FileText,
  CheckSquare,
  Package,
  Plus,
  DollarSign,
  PieChart,
  ArrowRight
} from 'lucide-react';
import BusinessPlanGenerator from './BusinessPlanGenerator';
import ProjectBudget from './ProjectBudget';

type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type InventoryItem = Database['public']['Tables']['items']['Row'];

const ProjectDetailView: React.FC<{ projectId?: string }> = ({ projectId: propProjectId }) => {
  const { id: paramProjectId } = useParams();
  const projectId = propProjectId === ':id' ? paramProjectId : propProjectId;
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isProjectComplete, setIsProjectComplete] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'budget'>('overview');

  useEffect(() => {
    if (!projectId) return;

    const fetchProjectData = async () => {
      try {
        // Fetch project
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error) {
          console.error('Error fetching project:', error);
          setError('Could not load project information');
        } else {
          setProject(data);
          // Check if project is at least 90% complete
          checkProjectCompletion(data);
          
          // Fetch related tasks
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false })
            .limit(5);
            
          if (tasksError) {
            console.error('Error fetching tasks:', tasksError);
          } else {
            setTasks(tasksData || []);
          }
          
          // Fetch related inventory items
          const { data: itemsData, error: itemsError } = await supabase
            .from('items')
            .select('*')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false });
            
          if (itemsError) {
            console.error('Error fetching inventory items:', itemsError);
          } else {
            setItems(itemsData || []);
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  // Check if project is at least 90% complete
  const checkProjectCompletion = (projectData: Project) => {
    // Define important fields to check for completion
    const requiredFields = [
      projectData.title,
      projectData.location,
      projectData.values_mission_goals,
      projectData.zone_0,
      projectData.zone_1,
      projectData.zone_2,
      projectData.zone_3,
      projectData.zone_4,
      projectData.water,
      projectData.soil,
      projectData.power,
    ];

    // Count non-empty fields
    const filledFields = requiredFields.filter(field => field && field.trim() !== '').length;
    
    // Check for array fields
    let arrayFieldsCount = 0;
    let filledArrayFields = 0;
    
    if (projectData.guilds) {
      arrayFieldsCount++;
      if (projectData.guilds.length > 0) filledArrayFields++;
    }
    
    if (projectData.structures) {
      arrayFieldsCount++;
      if (projectData.structures.length > 0) filledArrayFields++;
    }
    
    // Calculate total completion percentage
    const totalFields = requiredFields.length + arrayFieldsCount;
    const completedFields = filledFields + filledArrayFields;
    const completionPercentage = (completedFields / totalFields) * 100;
    
    // Project is considered complete if at least 90% of fields are filled
    setIsProjectComplete(completionPercentage >= 90);
  };

  const handleDelete = async () => {
    if (!project) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);
        
      if (error) {
        throw error;
      }
      
      // Navigate back to projects list
      navigate('/projects');
      
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
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

  if (!project) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        Project not found. It may have been deleted or you don't have access.
      </div>
    );
  }

  // Format dates
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const updatedDate = new Date(project.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6 mr-2" />
              <h3 className="text-xl font-bold">Delete Project</h3>
            </div>
            <p className="mb-4">Are you sure you want to delete "{project.title}"? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(false)}
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
                    Delete Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-green-700 h-48 relative flex items-center justify-center">
        <h1 className="text-4xl font-bold text-white">{project.title}</h1>
        <div className="absolute top-4 right-4 flex space-x-2">
          <button 
            className="bg-white bg-opacity-20 text-white p-2 rounded hover:bg-opacity-30"
            onClick={() => navigate(`/projects/edit/${project.id}`)}
          >
            <Edit className="h-5 w-5" />
          </button>
          <button 
            className="bg-white bg-opacity-20 text-white p-2 rounded hover:bg-opacity-30"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            className={`py-4 px-6 text-sm font-medium flex items-center ${
              activeTab === 'overview' 
                ? 'border-b-2 border-green-600 text-green-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            <Target className="h-4 w-4 mr-2" />
            Overview
          </button>
          <button
            className={`py-4 px-6 text-sm font-medium flex items-center ${
              activeTab === 'budget' 
                ? 'border-b-2 border-green-600 text-green-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('budget')}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Budget
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {activeTab === 'overview' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`text-sm font-semibold inline-block py-1 px-3 rounded-full ${
                project.property_status === 'owned_land' 
                  ? 'text-green-800 bg-green-100' 
                  : 'text-yellow-800 bg-yellow-100'
              }`}>
                {project.property_status === 'owned_land' ? 'Owned Land' : 'Potential Property'}
              </span>
              
              {project.category && (
                <span className="text-sm font-semibold inline-block py-1 px-3 rounded-full text-blue-800 bg-blue-100">
                  {project.category}
                </span>
              )}
              
              {project.funding_needs && (
                <span className="text-sm font-semibold inline-block py-1 px-3 rounded-full text-purple-800 bg-purple-100 flex items-center">
                  <DollarSign className="h-3 w-3 mr-1" />
                  Budget: {project.funding_needs}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="col-span-2">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Project Overview</h2>
                
                {project.location && (
                  <div className="flex items-center text-gray-600 mb-2">
                    <MapPin className="h-5 w-5 mr-2 text-green-600" />
                    <span>{project.location}</span>
                  </div>
                )}
                
                <div className="flex items-center text-gray-600 mb-4">
                  <CalendarClock className="h-5 w-5 mr-2 text-green-600" />
                  <span>Created on {createdDate} • Last updated {updatedDate}</span>
                </div>
                
                {project.values_mission_goals && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Values, Mission & Goals</h3>
                    <p className="text-gray-600">{project.values_mission_goals}</p>
                  </div>
                )}
                
                {project.funding_needs && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Funding Needs</h3>
                    <p className="text-gray-600">{project.funding_needs}</p>
                  </div>
                )}
              </div>
              
              <div>
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-blue-600" />
                    Guilds
                  </h3>
                  
                  {project.guilds && project.guilds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.guilds.map((guild, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                          {guild}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No guilds defined yet</p>
                  )}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-green-600" />
                    Team Members
                  </h3>
                  
                  {project.team && project.team.length > 0 ? (
                    <div className="space-y-2">
                      {project.team.map((memberId, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center mr-2 text-green-800 font-bold">
                            {memberId.substring(0, 2)}
                          </div>
                          <span className="text-gray-600">User {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No team members yet</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Tasks Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <CheckSquare className="h-6 w-6 mr-2 text-blue-600" />
                  Tasks
                </h2>
                <Link
                  to={`/projects/${project.id}/tasks`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View All Tasks
                </Link>
              </div>
              
              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.slice(0, 3).map(task => (
                    <Link key={task.id} to={`/tasks/${task.id}`} className="block">
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-800">{task.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                            {formatStatus(task.status)}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{task.description}</p>
                        )}
                        {task.due_date && (
                          <div className="text-xs text-gray-500">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                  <Link
                    to={`/tasks/new?project_id=${project.id}`}
                    className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200 p-4 h-full hover:bg-gray-200 transition-colors"
                  >
                    <div className="text-center">
                      <Plus className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                      <span className="text-gray-700">Add New Task</span>
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-600 mb-4">No tasks have been created for this project yet.</p>
                  <Link
                    to={`/tasks/new?project_id=${project.id}`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Plus className="h-5 w-5 mr-1" />
                    Create First Task
                  </Link>
                </div>
              )}
            </div>
            
            {/* Inventory Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Package className="h-6 w-6 mr-2 text-green-600" />
                  Inventory
                </h2>
                <Link
                  to={`/projects/${project.id}/inventory`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View All Items
                </Link>
              </div>
              
              {items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.slice(0, 3).map(item => (
                    <Link key={item.id} to={`/inventory/${item.id}`} className="block">
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-800">{item.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getItemTypeColor(item.item_type)}`}>
                            {formatItemType(item.item_type)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{item.description}</p>
                        )}
                        <div className="text-xs text-gray-500">
                          {getQuantityLabel(item)}
                        </div>
                        {item.price !== null && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            ${item.price.toFixed(2)} {item.price_currency || 'USD'}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                  <Link
                    to={`/inventory/new?project_id=${project.id}`}
                    className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200 p-4 h-full hover:bg-gray-200 transition-colors"
                  >
                    <div className="text-center">
                      <Plus className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                      <span className="text-gray-700">Add New Item</span>
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-600 mb-4">No inventory items have been added to this project yet.</p>
                  <Link
                    to={`/inventory/new?project_id=${project.id}`}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Plus className="h-5 w-5 mr-1" />
                    Add First Item
                  </Link>
                </div>
              )}
            </div>
            
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Permaculture Zones</h2>
              
              <div className="space-y-6">
                {project.zone_0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <CircleDot className="h-5 w-5 mr-2 text-red-600" />
                      Zone 0 - House/Main Building
                    </h3>
                    <p className="text-gray-600">{project.zone_0}</p>
                  </div>
                )}
                
                {project.zone_1 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <CircleDot className="h-5 w-5 mr-2 text-orange-600" />
                      Zone 1 - Frequent Attention
                    </h3>
                    <p className="text-gray-600">{project.zone_1}</p>
                  </div>
                )}
                
                {project.zone_2 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <CircleDot className="h-5 w-5 mr-2 text-yellow-600" />
                      Zone 2 - Regular Attention
                    </h3>
                    <p className="text-gray-600">{project.zone_2}</p>
                  </div>
                )}
                
                {project.zone_3 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <CircleDot className="h-5 w-5 mr-2 text-green-600" />
                      Zone 3 - Occasional Attention
                    </h3>
                    <p className="text-gray-600">{project.zone_3}</p>
                  </div>
                )}
                
                {project.zone_4 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <CircleDot className="h-5 w-5 mr-2 text-blue-600" />
                      Zone 4 - Semi-Wild Areas
                    </h3>
                    <p className="text-gray-600">{project.zone_4}</p>
                  </div>
                )}
                
                {!project.zone_0 && !project.zone_1 && !project.zone_2 && !project.zone_3 && !project.zone_4 && (
                  <p className="text-gray-500">No zone information provided yet</p>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Infrastructure</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {project.water && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <Droplets className="h-5 w-5 mr-2 text-blue-600" />
                      Water Systems
                    </h3>
                    <p className="text-gray-600">{project.water}</p>
                  </div>
                )}
                
                {project.soil && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <Sprout className="h-5 w-5 mr-2 text-green-600" />
                      Soil Management
                    </h3>
                    <p className="text-gray-600">{project.soil}</p>
                  </div>
                )}
                
                {project.power && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-yellow-600" />
                      Power Systems
                    </h3>
                    <p className="text-gray-600">{project.power}</p>
                  </div>
                )}
                
                {project.structures && project.structures.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-purple-600" />
                      Structures
                    </h3>
                    <ul className="list-disc list-inside text-gray-600">
                      {project.structures.map((structure, index) => (
                        <li key={index}>{structure}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {!project.water && !project.soil && !project.power && (!project.structures || project.structures.length === 0) && (
                  <p className="text-gray-500 col-span-3">No infrastructure information provided yet</p>
                )}
              </div>
            </div>
            
            {/* Business Plan Generator */}
            <BusinessPlanGenerator project={project} visible={isProjectComplete} />
            
            {/* If project is not complete enough, show message */}
            {!isProjectComplete && (
              <div className="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="flex items-center text-gray-700 font-semibold">
                  <FileText className="h-5 w-5 mr-2 text-gray-500" />
                  Business Plan Generation
                </h3>
                <p className="text-gray-600 mt-2">
                  Complete at least 90% of your project details to unlock the business plan generator.
                  This will create a comprehensive business plan you can download and share.
                </p>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'budget' && (
          <ProjectBudget 
            project={project} 
            items={items} 
          />
        )}
      </div>
    </div>
  );
};

// Helper functions for task status colors and formatting
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

// Helper functions for inventory item type colors and formatting
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

const formatItemType = (type: string) => {
  switch (type) {
    case 'needed_supply':
      return 'Needed';
    case 'owned_resource':
      return 'Owned';
    case 'borrowed_or_rental':
      return 'Borrowed';
    default:
      return type;
  }
};

const getQuantityLabel = (item: InventoryItem) => {
  if (item.item_type === 'needed_supply' && item.quantity_needed !== null) {
    return `Needed: ${item.quantity_needed} ${item.unit || 'units'}`;
  }
  if (item.item_type === 'owned_resource' && item.quantity_owned !== null) {
    return `Owned: ${item.quantity_owned} ${item.unit || 'units'}`;
  }
  if (item.item_type === 'borrowed_or_rental' && item.quantity_borrowed !== null) {
    return `Borrowed: ${item.quantity_borrowed} ${item.unit || 'units'}`;
  }
  return '';
};

export default ProjectDetailView;