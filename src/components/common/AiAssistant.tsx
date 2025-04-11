import React, { useState } from 'react';
import { Sparkles, X, Send, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { generateWithOpenAI } from '../../lib/openai';
import { Link } from 'react-router-dom';

interface AiAssistantProps {
  onClose: () => void;
  onSubmit: (suggestion: string) => void;
  fieldName: string;
  locationContext?: string;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ onClose, onSubmit, fieldName, locationContext }) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Get a field-specific placeholder based on the fieldName
  const getPlaceholder = () => {
    const locationPrefix = locationContext ? `for ${locationContext}` : "";
    
    switch (fieldName) {
      case 'title':
        return `e.g., Generate a catchy name for my permaculture project ${locationPrefix}`;
      case 'valuesMissionGoals':
        return `e.g., Help me write a mission statement for a community garden ${locationPrefix} focused on education`;
      case 'zone0':
        return locationContext 
          ? `e.g., Suggest home/building features appropriate for ${locationContext}'s climate`
          : "e.g., Suggest ideas for zone 0 in a small urban lot";
      case 'zone1':
        return locationContext 
          ? `e.g., What plants should I include in zone 1 for ${locationContext}'s climate?`
          : "e.g., What plants should I include in zone 1 for a Mediterranean climate?";
      case 'zone2':
        return locationContext 
          ? `e.g., Suggest a layout for fruit trees and perennials in zone 2 that thrive in ${locationContext}`
          : "e.g., Suggest a layout for fruit trees and perennials in zone 2";
      case 'zone3':
        return locationContext 
          ? `e.g., Ideas for low-maintenance crops for zone 3 that grow well in ${locationContext}`
          : "e.g., Ideas for low-maintenance crops for zone 3";
      case 'zone4':
        return locationContext 
          ? `e.g., How should I design a semi-wild zone 4 area for wildlife in ${locationContext}?`
          : "e.g., How should I design a semi-wild zone 4 area for wildlife?";
      case 'water':
        return locationContext 
          ? `e.g., Suggest a rainwater harvesting system for ${locationContext}'s rainfall patterns`
          : "e.g., Suggest a rainwater harvesting system for a 1-acre property";
      case 'soil':
        return locationContext 
          ? `e.g., What soil amendments should I use for typical soil in ${locationContext}?`
          : "e.g., What soil amendments should I use for clay soil?";
      case 'power':
        return locationContext 
          ? `e.g., Recommend renewable energy options for ${locationContext}'s climate conditions`
          : "e.g., Recommend renewable energy options for a small homestead";
      case 'all':
        return locationContext 
          ? `e.g., Suggest permaculture zones and infrastructure specific to ${locationContext}`
          : "e.g., Create a complete permaculture project plan";
      default:
        return "Describe what you need help with...";
    }
  };

  // Get a field-specific title based on the fieldName
  const getTitle = () => {
    switch (fieldName) {
      case 'title':
        return "Project Title";
      case 'valuesMissionGoals':
        return "Values, Mission & Goals";
      case 'zone0':
        return "Zone 0 - House/Main Building";
      case 'zone1':
        return "Zone 1 - Frequent Attention";
      case 'zone2':
        return "Zone 2 - Regular Attention";
      case 'zone3':
        return "Zone 3 - Occasional Attention";
      case 'zone4':
        return "Zone 4 - Semi-Wild Areas";
      case 'water':
        return "Water Systems";
      case 'soil':
        return "Soil Management";
      case 'power':
        return "Power Systems";
      case 'all':
        return "Complete Project Suggestions";
      default:
        return "AI Assistant";
    }
  };

  const generateSuggestion = async () => {
    if (!prompt.trim() && !locationContext) return;
    
    setLoading(true);
    setError(null);
    setApiKeyMissing(false);
    
    try {
      // If location is provided but no prompt, create a default prompt based on location
      const finalPrompt = prompt.trim() || 
        (locationContext ? `Suggest appropriate ${getTitle()} for a permaculture project in ${locationContext}` : "");
      
      const aiResponse = await generateWithOpenAI({
        userId: user.id,
        prompt: finalPrompt,
        fieldName: fieldName,
        locationContext: locationContext
      });
      
      setSuggestion(aiResponse);
      
    } catch (err) {
      console.error('Error generating AI response:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('No OpenAI API key found')) {
          setApiKeyMissing(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to generate a suggestion. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseResponse = () => {
    onSubmit(suggestion);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center">
            <Sparkles className="h-5 w-5 text-purple-600 mr-2" />
            AI Assistant: {getTitle()}
            {locationContext && (
              <span className="ml-2 text-sm text-green-600">
                (for {locationContext})
              </span>
            )}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {apiKeyMissing && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
            <p className="font-semibold mb-1">OpenAI API Key Required</p>
            <p className="mb-2">To use AI assistance, you need to add your OpenAI API key in settings.</p>
            <Link
              to="/settings/api-keys"
              className="inline-flex items-center text-sm bg-yellow-800 text-white px-3 py-1 rounded hover:bg-yellow-900"
            >
              <Settings className="h-4 w-4 mr-1" />
              Add API Key
            </Link>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2">
            What would you like help with?
            {locationContext && (
              <span className="ml-1 text-green-600 text-xs">
                (Your location will be used to provide relevant suggestions)
              </span>
            )}
          </label>
          <div className="flex">
            <input
              type="text"
              className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={loading}
            />
            <button
              onClick={generateSuggestion}
              disabled={loading || ((!prompt.trim() && !locationContext) || apiKeyMissing)}
              className="px-4 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          {locationContext && !prompt.trim() && (
            <p className="text-xs text-green-600 mt-1">
              You can leave this empty to get automatic suggestions based on your location.
            </p>
          )}
        </div>
        
        {(loading || suggestion) && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              {loading ? "Generating suggestion..." : "AI Suggestion"}
            </label>
            <div className={`bg-purple-50 border border-purple-200 rounded-md p-4 ${fieldName === 'all' ? 'h-60 overflow-y-auto' : 'min-h-[100px]'}`}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                </div>
              ) : (
                <p className="text-gray-800 whitespace-pre-wrap">{suggestion}</p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleUseResponse}
            disabled={!suggestion || loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Use Suggestion
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;