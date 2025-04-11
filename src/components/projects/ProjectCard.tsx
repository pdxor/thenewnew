import React from 'react';
import { Database } from '../../types/supabase';
import { MapPin, Users, Calendar } from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  // Format date
  const formattedDate = new Date(project.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Get guild badges (max 3)
  const displayedGuilds = project.guilds?.slice(0, 3) || [];
  const remainingGuilds = project.guilds && project.guilds.length > 3 
    ? project.guilds.length - 3 
    : 0;

  // Placeholder image URL from Unsplash - farm/permaculture related
  const placeholderImage = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:shadow-lg hover:-translate-y-1">
      <div className="h-48 overflow-hidden">
        <img 
          src={placeholderImage} 
          alt={project.title} 
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="p-5">
        <div className="mb-3">
          <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${
            project.property_status === 'owned_land' 
              ? 'text-green-800 bg-green-100' 
              : 'text-yellow-800 bg-yellow-100'
          }`}>
            {project.property_status === 'owned_land' ? 'Owned Land' : 'Potential Property'}
          </span>
        </div>
        
        <h2 className="text-xl font-bold text-gray-800 mb-2">{project.title}</h2>
        
        {project.location && (
          <div className="flex items-center text-gray-600 mb-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span className="text-sm">{project.location}</span>
          </div>
        )}
        
        <div className="flex items-center text-gray-600 mb-4">
          <Calendar className="h-4 w-4 mr-1" />
          <span className="text-sm">Created {formattedDate}</span>
        </div>
        
        {project.guilds && project.guilds.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {displayedGuilds.map((guild, index) => (
                <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {guild}
                </span>
              ))}
              {remainingGuilds > 0 && (
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                  +{remainingGuilds} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {project.team && project.team.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 mr-1" />
              <span className="text-sm">{project.team.length} team member{project.team.length !== 1 ? 's' : ''}</span>
            </div>
            
            <button className="text-green-600 hover:text-green-800 text-sm font-medium">
              View Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCard;