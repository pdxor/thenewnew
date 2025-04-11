import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Plus, Trash2, Save, X, Sparkles, Loader2, DollarSign } from 'lucide-react';
import AiAssistant from '../common/AiAssistant';

const ProjectCreateForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [activeField, setActiveField] = useState<string>('');
  const [suggestAllLoading, setSuggestAllLoading] = useState(false);
  
  // Basic details
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<'owned_land' | 'potential_property'>('owned_land');
  const [valuesMissionGoals, setValuesMissionGoals] = useState('');
  const [category, setCategory] = useState('');
  const [fundingNeeds, setFundingNeeds] = useState('');
  
  // Guilds
  const [newGuild, setNewGuild] = useState('');
  const [guilds, setGuilds] = useState<string[]>([]);
  
  // Team members (would be email addresses to invite)
  const [newTeamMember, setNewTeamMember] = useState('');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  
  // Permaculture zones
  const [zone0, setZone0] = useState('');
  const [zone1, setZone1] = useState('');
  const [zone2, setZone2] = useState('');
  const [zone3, setZone3] = useState('');
  const [zone4, setZone4] = useState('');
  
  // Infrastructure
  const [water, setWater] = useState('');
  const [soil, setSoil] = useState('');
  const [power, setPower] = useState('');
  
  // Structures
  const [newStructure, setNewStructure] = useState('');
  const [structures, setStructures] = useState<string[]>([]);

  // Location change effect
  useEffect(() => {
    // Only show suggestion buttons when location is provided
    if (location.trim()) {
      // Clean up any location suggestion indicators
      document.querySelectorAll('.location-suggestion-indicator').forEach(el => {
        el.classList.add('opacity-100');
      });
    }
  }, [location]);

  const handleAddGuild = () => {
    if (newGuild.trim() !== '' && !guilds.includes(newGuild.trim())) {
      setGuilds([...guilds, newGuild.trim()]);
      setNewGuild('');
    }
  };

  const handleRemoveGuild = (guildToRemove: string) => {
    setGuilds(guilds.filter(guild => guild !== guildToRemove));
  };

  const handleAddTeamMember = () => {
    if (newTeamMember.trim() !== '' && !teamMembers.includes(newTeamMember.trim())) {
      setTeamMembers([...teamMembers, newTeamMember.trim()]);
      setNewTeamMember('');
    }
  };

  const handleRemoveTeamMember = (memberToRemove: string) => {
    setTeamMembers(teamMembers.filter(member => member !== memberToRemove));
  };

  const handleAddStructure = () => {
    if (newStructure.trim() !== '' && !structures.includes(newStructure.trim())) {
      setStructures([...structures, newStructure.trim()]);
      setNewStructure('');
    }
  };

  const handleRemoveStructure = (structureToRemove: string) => {
    setStructures(structures.filter(structure => structure !== structureToRemove));
  };

  const handleAIAssist = (field: string) => {
    setActiveField(field);
    setShowAiAssistant(true);
  };

  // Helper function to ensure string values
  const ensureString = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const handleAIResponse = (response: string) => {
    // Update the appropriate field based on activeField
    switch (activeField) {
      case 'title':
        setTitle(response);
        break;
      case 'valuesMissionGoals':
        setValuesMissionGoals(response);
        break;
      case 'zone0':
        setZone0(response);
        break;
      case 'zone1':
        setZone1(response);
        break;
      case 'zone2':
        setZone2(response);
        break;
      case 'zone3':
        setZone3(response);
        break;
      case 'zone4':
        setZone4(response);
        break;
      case 'water':
        setWater(response);
        break;
      case 'soil':
        setSoil(response);
        break;
      case 'power':
        setPower(response);
        break;
      case 'all':
        try {
          const suggestions = JSON.parse(response);
          if (suggestions) {
            if (suggestions.title) setTitle(ensureString(suggestions.title));
            if (suggestions.valuesMissionGoals) setValuesMissionGoals(ensureString(suggestions.valuesMissionGoals));
            if (suggestions.zone0) setZone0(ensureString(suggestions.zone0));
            if (suggestions.zone1) setZone1(ensureString(suggestions.zone1));
            if (suggestions.zone2) setZone2(ensureString(suggestions.zone2));
            if (suggestions.zone3) setZone3(ensureString(suggestions.zone3));
            if (suggestions.zone4) setZone4(ensureString(suggestions.zone4));
            if (suggestions.water) setWater(ensureString(suggestions.water));
            if (suggestions.soil) setSoil(ensureString(suggestions.soil));
            if (suggestions.power) setPower(ensureString(suggestions.power));
            if (suggestions.guilds && Array.isArray(suggestions.guilds)) {
              // Make sure each guild is a string
              const stringGuilds = suggestions.guilds.map(guild => ensureString(guild));
              setGuilds(stringGuilds);
            }
            if (suggestions.structures && Array.isArray(suggestions.structures)) {
              // Make sure each structure is a string
              const stringStructures = suggestions.structures.map(structure => ensureString(structure));
              setStructures(stringStructures);
            }
          }
        } catch (err) {
          console.error("Failed to parse all fields response:", err);
          // Attempt to fix the JSON string if it's malformed
          try {
            // If the response starts with a backtick markdown code block, extract the JSON
            if (response.startsWith('```json') && response.includes('```')) {
              const jsonContent = response.split('```json')[1].split('```')[0].trim();
              const suggestions = JSON.parse(jsonContent);
              
              if (suggestions) {
                if (suggestions.title) setTitle(ensureString(suggestions.title));
                if (suggestions.valuesMissionGoals) setValuesMissionGoals(ensureString(suggestions.valuesMissionGoals));
                if (suggestions.zone0) setZone0(ensureString(suggestions.zone0));
                if (suggestions.zone1) setZone1(ensureString(suggestions.zone1));
                if (suggestions.zone2) setZone2(ensureString(suggestions.zone2));
                if (suggestions.zone3) setZone3(ensureString(suggestions.zone3));
                if (suggestions.zone4) setZone4(ensureString(suggestions.zone4));
                if (suggestions.water) setWater(ensureString(suggestions.water));
                if (suggestions.soil) setSoil(ensureString(suggestions.soil));
                if (suggestions.power) setPower(ensureString(suggestions.power));
                if (suggestions.guilds && Array.isArray(suggestions.guilds)) {
                  setGuilds(suggestions.guilds.map(guild => ensureString(guild)));
                }
                if (suggestions.structures && Array.isArray(suggestions.structures)) {
                  setStructures(suggestions.structures.map(structure => ensureString(structure)));
                }
              }
            }
          } catch (jsonErr) {
            console.error("Failed to fix malformed JSON:", jsonErr);
          }
        }
        break;
      default:
        break;
    }
    setShowAiAssistant(false);
  };

  const handleSuggestAll = () => {
    if (!location) return;
    
    setActiveField('all');
    setShowAiAssistant(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // First, try to lookup team members by email to get their IDs
      const teamIds: string[] = [];
      
      // If there are team members emails, this would be where we'd look them up
      // For now, we'll just use an empty array as the team
      
      const projectData = {
        title,
        location,
        property_status: propertyStatus,
        values_mission_goals: valuesMissionGoals,
        guilds,
        team: teamIds, // Just empty for now
        zone_0: zone0,
        zone_1: zone1,
        zone_2: zone2,
        zone_3: zone3,
        zone_4: zone4,
        water,
        soil,
        power,
        structures,
        category,
        funding_needs: fundingNeeds,
        created_by: user.id,
      };
      
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert(projectData)
        .select('id')
        .single();
        
      if (insertError) {
        throw insertError;
      }
      
      // Set success message and clear form or redirect
      setSuccess('Project created successfully!');
      
      // Wait a moment then redirect to the project list page
      setTimeout(() => {
        navigate('/projects');
      }, 2000);
      
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Create New Project</h1>
      
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
      
      {showAiAssistant && (
        <AiAssistant 
          onClose={() => setShowAiAssistant(false)}
          onSubmit={handleAIResponse}
          fieldName={activeField}
          locationContext={location}
        />
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4 relative">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="title">
                Project Title *
              </label>
              <div className="flex">
                <input
                  id="title"
                  type="text"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => handleAIAssist('title')}
                  className="px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700"
                  title="Get AI assistance"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="location">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="location"
                  type="text"
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country (e.g., Portland, USA)"
                />
                {location && (
                  <div className="text-xs text-green-600 mt-1">
                    Location-specific recommendations available for zones and infrastructure
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {location && (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={handleSuggestAll}
                className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Suggest All Fields for {location}
              </button>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Property Status *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-green-600"
                  value="owned_land"
                  checked={propertyStatus === 'owned_land'}
                  onChange={() => setPropertyStatus('owned_land')}
                />
                <span className="ml-2 text-gray-700">Owned Land</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-yellow-600"
                  value="potential_property"
                  checked={propertyStatus === 'potential_property'}
                  onChange={() => setPropertyStatus('potential_property')}
                />
                <span className="ml-2 text-gray-700">Potential Property</span>
              </label>
            </div>
          </div>
          
          <div className="mb-4 relative">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="valuesMissionGoals">
              Values, Mission & Goals
            </label>
            <div className="flex">
              <textarea
                id="valuesMissionGoals"
                className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={valuesMissionGoals}
                onChange={(e) => setValuesMissionGoals(e.target.value)}
                rows={3}
                placeholder="Describe the purpose and goals of this project"
              ></textarea>
              <button
                type="button"
                onClick={() => handleAIAssist('valuesMissionGoals')}
                className="px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center"
                title="Get AI assistance"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="category">
                Category
              </label>
              <input
                id="category"
                type="text"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Urban Farm, Homestead, etc."
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="fundingNeeds">
                Project Budget
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="fundingNeeds"
                  type="text"
                  className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={fundingNeeds}
                  onChange={(e) => setFundingNeeds(e.target.value)}
                  placeholder="e.g., 5000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter your total project budget. This will be used to track expenses against your budget.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Guilds</h2>
          <p className="text-gray-500 text-sm mb-3">
            Add categories or types of plants/animals/elements that will be integrated in your project.
          </p>
          
          <div className="flex flex-wrap gap-2 mb-2">
            {guilds.map((guild, index) => (
              <div 
                key={index}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
              >
                {guild}
                <button
                  type="button"
                  onClick={() => handleRemoveGuild(guild)}
                  className="ml-1 text-blue-700 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex">
            <input
              type="text"
              className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={newGuild}
              onChange={(e) => setNewGuild(e.target.value)}
              placeholder="Add a guild (e.g., Fruit Trees, Poultry, Water Features)"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGuild())}
            />
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
              onClick={handleAddGuild}
            >
              Add
            </button>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Team Members</h2>
          <p className="text-gray-500 text-sm mb-3">
            Invite team members to collaborate on this project (by email).
          </p>
          
          <div className="flex flex-wrap gap-2 mb-2">
            {teamMembers.map((member, index) => (
              <div 
                key={index}
                className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm flex items-center"
              >
                <Users className="h-3 w-3 mr-1" />
                {member}
                <button
                  type="button"
                  onClick={() => handleRemoveTeamMember(member)}
                  className="ml-1 text-green-700 hover:text-green-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex">
            <div className="relative flex-1">
              <Users className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                className="w-full pl-10 pr-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={newTeamMember}
                onChange={(e) => setNewTeamMember(e.target.value)}
                placeholder="Enter email address"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTeamMember())}
              />
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700"
              onClick={handleAddTeamMember}
            >
              Invite
            </button>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Permaculture Zones</h2>
          <p className="text-gray-500 text-sm mb-3">
            Describe how you'll organize your project according to permaculture zone principles.
            {location && (
              <span className="text-green-600 ml-1">
                Get location-specific recommendations for {location} by clicking the sparkle button.
              </span>
            )}
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="zone0">
                Zone 0 - House/Main Building
              </label>
              <div className="flex">
                <textarea
                  id="zone0"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={zone0}
                  onChange={(e) => setZone0(e.target.value)}
                  rows={2}
                  placeholder={location ? `Describe your home/building for ${location}` : "Describe your home, main building, or central area"}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('zone0')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get location-specific suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="zone1">
                Zone 1 - Frequent Attention
              </label>
              <div className="flex">
                <textarea
                  id="zone1"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={zone1}
                  onChange={(e) => setZone1(e.target.value)}
                  rows={2}
                  placeholder={location ? `Describe frequently visited areas appropriate for ${location}` : "Areas you visit daily - kitchen gardens, herbs, etc."}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('zone1')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get location-specific suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="zone2">
                Zone 2 - Regular Attention
              </label>
              <div className="flex">
                <textarea
                  id="zone2"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={zone2}
                  onChange={(e) => setZone2(e.target.value)}
                  rows={2}
                  placeholder={location ? `Describe areas needing regular attention suitable for ${location}'s climate` : "Areas needing attention every few days - fruit trees, main crops, etc."}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('zone2')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get location-specific suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="zone3">
                Zone 3 - Occasional Attention
              </label>
              <div className="flex">
                <textarea
                  id="zone3"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={zone3}
                  onChange={(e) => setZone3(e.target.value)}
                  rows={2}
                  placeholder={location ? `Describe commercial/large crops appropriate for ${location}` : "Commercial crops, grazing areas, orchards"}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('zone3')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get location-specific suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="zone4">
                Zone 4 - Semi-Wild Areas
              </label>
              <div className="flex">
                <textarea
                  id="zone4"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={zone4}
                  onChange={(e) => setZone4(e.target.value)}
                  rows={2}
                  placeholder={location ? `Describe semi-wild areas suitable for ${location}'s ecosystem` : "Woodlots, wild food collection, minimal management"}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('zone4')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get location-specific suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Infrastructure</h2>
          <p className="text-gray-500 text-sm mb-3">
            Define the infrastructure systems for your project.
            {location && (
              <span className="text-green-600 ml-1">
                Get location-appropriate infrastructure suggestions for {location}.
              </span>
            )}
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="water">
                Water Systems
              </label>
              <div className="flex">
                <textarea
                  id="water"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                  rows={2}
                  placeholder={location ? `Water management strategies for ${location}'s climate and rainfall patterns` : "Describe water collection, storage, irrigation, etc."}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('water')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get water system suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="soil">
                Soil Management
              </label>
              <div className="flex">
                <textarea
                  id="soil"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={soil}
                  onChange={(e) => setSoil(e.target.value)}
                  rows={2}
                  placeholder={location ? `Soil improvement strategies for typical ${location} soil conditions` : "Describe soil types, amendments, composting systems, etc."}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('soil')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get soil management suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="power">
                Power Systems
              </label>
              <div className="flex">
                <textarea
                  id="power"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                  rows={2}
                  placeholder={location ? `Appropriate renewable energy options for ${location}` : "Describe electricity, renewable energy, etc."}
                ></textarea>
                <button
                  type="button"
                  onClick={() => handleAIAssist('power')}
                  className={`px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 self-stretch flex items-center location-suggestion-indicator ${location ? 'opacity-100' : 'opacity-100'}`}
                  title={location ? `Get power system suggestions for ${location}` : "Get AI assistance"}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Structures
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {structures.map((structure, index) => (
                  <div 
                    key={index}
                    className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm flex items-center"
                  >
                    {structure}
                    <button
                      type="button"
                      onClick={() => handleRemoveStructure(structure)}
                      className="ml-1 text-gray-600 hover:text-gray-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newStructure}
                  onChange={(e) => setNewStructure(e.target.value)}
                  placeholder={location ? `Buildings appropriate for ${location}'s climate` : "Add buildings, sheds, greenhouses, etc."}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStructure())}
                />
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded-r-md hover:bg-gray-700"
                  onClick={handleAddStructure}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Project...
              </span>
            ) : (
              <span className="flex items-center">
                <Save className="h-5 w-5 mr-2" />
                Create Project
              </span>
            )}
          </button>
          
          <button
            type="button"
            className="bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
            onClick={() => navigate('/projects')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreateForm;