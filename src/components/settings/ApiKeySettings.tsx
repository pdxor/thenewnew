import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { Key, Eye, EyeOff, Save, Info, AlertCircle, Search } from 'lucide-react';

type ApiKey = Database['public']['Tables']['api_keys']['Row'];

const ApiKeySettings: React.FC = () => {
  const { user } = useAuth();
  const [openAiKey, setOpenAiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleCseId, setGoogleCseId] = useState('');
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showGoogleApiKey, setShowGoogleApiKey] = useState(false);
  const [showGoogleCseId, setShowGoogleCseId] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openAiKeyExists, setOpenAiKeyExists] = useState(false);
  const [googleApiKeyExists, setGoogleApiKeyExists] = useState(false);
  const [googleCseIdExists, setGoogleCseIdExists] = useState(false);
  
  useEffect(() => {
    if (!user) return;
    
    const fetchApiKeys = async () => {
      try {
        // Fetch OpenAI API key
        const { data: openAiData, error: openAiError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('user_id', user.id)
          .eq('service', 'openai')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (openAiError) {
          console.error('Error fetching OpenAI API key:', openAiError);
          setError(`Failed to retrieve API key: ${openAiError.message}`);
          return;
        }

        if (openAiData) {
          setOpenAiKey(openAiData.key);
          setOpenAiKeyExists(true);
        } else {
          setOpenAiKey('');
          setOpenAiKeyExists(false);
        }
        
        // Fetch Google API key
        const { data: googleData, error: googleError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('user_id', user.id)
          .eq('service', 'google')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (googleError) {
          console.error('Error fetching Google API key:', googleError);
        } else if (googleData) {
          setGoogleApiKey(googleData.key);
          setGoogleApiKeyExists(true);
        }
        
        // Fetch Google CSE ID
        const { data: cseData, error: cseError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('user_id', user.id)
          .eq('service', 'google_cse')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (cseError) {
          console.error('Error fetching Google CSE ID:', cseError);
        } else if (cseData) {
          setGoogleCseId(cseData.key);
          setGoogleCseIdExists(true);
        }
        
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred while fetching the API keys');
      } finally {
        setLoading(false);
      }
    };
    
    fetchApiKeys();
  }, [user]);
  
  const handleToggleShowOpenAiKey = () => {
    setShowOpenAiKey(!showOpenAiKey);
  };
  
  const handleToggleShowGoogleApiKey = () => {
    setShowGoogleApiKey(!showGoogleApiKey);
  };
  
  const handleToggleShowGoogleCseId = () => {
    setShowGoogleCseId(!showGoogleCseId);
  };
  
  const handleSaveOpenAiKey = async () => {
    if (!user || !openAiKey.trim()) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Delete any existing keys first to maintain uniqueness
      if (openAiKeyExists) {
        const { error: deleteError } = await supabase
          .from('api_keys')
          .delete()
          .eq('user_id', user.id)
          .eq('service', 'openai');
          
        if (deleteError) {
          throw deleteError;
        }
      }

      // Insert new key
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          service: 'openai',
          key: openAiKey
        });
        
      if (insertError) {
        throw insertError;
      }
      
      setOpenAiKeyExists(true);
      setSuccess('OpenAI API key saved successfully');
    } catch (err: any) {
      console.error('Error saving OpenAI API key:', err);
      setError(`Failed to save OpenAI API key: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveGoogleApiKey = async () => {
    if (!user || !googleApiKey.trim()) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Delete any existing keys first to maintain uniqueness
      if (googleApiKeyExists) {
        const { error: deleteError } = await supabase
          .from('api_keys')
          .delete()
          .eq('user_id', user.id)
          .eq('service', 'google');
          
        if (deleteError) {
          throw deleteError;
        }
      }

      // Insert new key
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          service: 'google',
          key: googleApiKey
        });
        
      if (insertError) {
        throw insertError;
      }
      
      setGoogleApiKeyExists(true);
      setSuccess('Google API key saved successfully');
    } catch (err: any) {
      console.error('Error saving Google API key:', err);
      setError(`Failed to save Google API key: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveGoogleCseId = async () => {
    if (!user || !googleCseId.trim()) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Delete any existing keys first to maintain uniqueness
      if (googleCseIdExists) {
        const { error: deleteError } = await supabase
          .from('api_keys')
          .delete()
          .eq('user_id', user.id)
          .eq('service', 'google_cse');
          
        if (deleteError) {
          throw deleteError;
        }
      }

      // Insert new key
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          service: 'google_cse',
          key: googleCseId
        });
        
      if (insertError) {
        throw insertError;
      }
      
      setGoogleCseIdExists(true);
      setSuccess('Google Custom Search Engine ID saved successfully');
    } catch (err: any) {
      console.error('Error saving Google CSE ID:', err);
      setError(`Failed to save Google CSE ID: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const validateOpenAiKey = () => {
    if (!openAiKey.trim()) return false;
    // Basic validation for OpenAI API key format (starts with "sk-" and is at least 32 chars)
    return openAiKey.startsWith('sk-') && openAiKey.length >= 32;
  };
  
  const validateGoogleApiKey = () => {
    if (!googleApiKey.trim()) return false;
    // Basic validation for Google API key format (alphanumeric with dashes, at least 20 chars)
    return /^[A-Za-z0-9_-]{20,}$/.test(googleApiKey);
  };
  
  const validateGoogleCseId = () => {
    if (!googleCseId.trim()) return false;
    // Basic validation for Google CSE ID format (alphanumeric with colons, at least 10 chars)
    return /^[A-Za-z0-9:_-]{10,}$/.test(googleCseId);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-24">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">API Key Settings</h2>
      
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
      
      {/* OpenAI API Key Section */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <h3 className="text-md font-semibold text-gray-700 flex items-center">
            <Key className="h-5 w-5 mr-2 text-purple-600" />
            OpenAI API Key
          </h3>
          <div className="ml-auto">
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
            >
              <Info className="h-4 w-4 mr-1" />
              Get API Key
            </a>
          </div>
        </div>
        
        <div className="relative mb-2">
          <input
            type={showOpenAiKey ? "text" : "password"}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
          />
          <button
            type="button"
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            onClick={handleToggleShowOpenAiKey}
          >
            {showOpenAiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-3">
          Your API key is securely stored and encrypted in our database.
        </p>
        
        {openAiKey && !validateOpenAiKey() && (
          <div className="mt-2 text-amber-600 flex items-center text-sm mb-3">
            <AlertCircle className="h-4 w-4 mr-1" />
            This doesn't look like a valid OpenAI API key. Keys should start with 'sk-'.
          </div>
        )}
        
        <button
          onClick={handleSaveOpenAiKey}
          disabled={saving || !validateOpenAiKey()}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 flex items-center justify-center disabled:bg-purple-300"
        >
          {saving ? (
            <span className="flex items-center">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 text-white rounded-full border-2 border-white border-t-transparent"></div>
              Saving...
            </span>
          ) : (
            <span className="flex items-center">
              <Save className="h-5 w-5 mr-2" />
              Save OpenAI API Key
            </span>
          )}
        </button>
      </div>
      
      {/* Google API Key Section */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <h3 className="text-md font-semibold text-gray-700 flex items-center">
            <Search className="h-5 w-5 mr-2 text-blue-600" />
            Google API Key
          </h3>
          <div className="ml-auto">
            <a 
              href="https://console.cloud.google.com/apis/credentials" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Info className="h-4 w-4 mr-1" />
              Get API Key
            </a>
          </div>
        </div>
        
        <div className="relative mb-2">
          <input
            type={showGoogleApiKey ? "text" : "password"}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={googleApiKey}
            onChange={(e) => setGoogleApiKey(e.target.value)}
            placeholder="Enter your Google API key"
          />
          <button
            type="button"
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            onClick={handleToggleShowGoogleApiKey}
          >
            {showGoogleApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-3">
          Required for product search functionality. Enable the Custom Search API in your Google Cloud Console.
        </p>
        
        {googleApiKey && !validateGoogleApiKey() && (
          <div className="mt-2 text-amber-600 flex items-center text-sm mb-3">
            <AlertCircle className="h-4 w-4 mr-1" />
            This doesn't look like a valid Google API key.
          </div>
        )}
        
        <button
          onClick={handleSaveGoogleApiKey}
          disabled={saving || !validateGoogleApiKey()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center disabled:bg-blue-300"
        >
          {saving ? (
            <span className="flex items-center">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 text-white rounded-full border-2 border-white border-t-transparent"></div>
              Saving...
            </span>
          ) : (
            <span className="flex items-center">
              <Save className="h-5 w-5 mr-2" />
              Save Google API Key
            </span>
          )}
        </button>
      </div>
      
      {/* Google Custom Search Engine ID Section */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <h3 className="text-md font-semibold text-gray-700 flex items-center">
            <Search className="h-5 w-5 mr-2 text-blue-600" />
            Google Custom Search Engine ID
          </h3>
          <div className="ml-auto">
            <a 
              href="https://programmablesearchengine.google.com/controlpanel/create" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Info className="h-4 w-4 mr-1" />
              Create CSE
            </a>
          </div>
        </div>
        
        <div className="relative mb-2">
          <input
            type={showGoogleCseId ? "text" : "password"}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={googleCseId}
            onChange={(e) => setGoogleCseId(e.target.value)}
            placeholder="Enter your Google Custom Search Engine ID"
          />
          <button
            type="button"
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            onClick={handleToggleShowGoogleCseId}
          >
            {showGoogleCseId ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-3">
          Create a Programmable Search Engine and enable "Search the entire web" option.
        </p>
        
        {googleCseId && !validateGoogleCseId() && (
          <div className="mt-2 text-amber-600 flex items-center text-sm mb-3">
            <AlertCircle className="h-4 w-4 mr-1" />
            This doesn't look like a valid Google Custom Search Engine ID.
          </div>
        )}
        
        <button
          onClick={handleSaveGoogleCseId}
          disabled={saving || !validateGoogleCseId()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center disabled:bg-blue-300"
        >
          {saving ? (
            <span className="flex items-center">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 text-white rounded-full border-2 border-white border-t-transparent"></div>
              Saving...
            </span>
          ) : (
            <span className="flex items-center">
              <Save className="h-5 w-5 mr-2" />
              Save Google CSE ID
            </span>
          )}
        </button>
      </div>
      
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-800 mb-2">Why do I need these API keys?</h4>
        <p className="text-blue-700 text-sm mb-2">
          <strong>OpenAI API Key:</strong> Allows you to use AI assistance for generating content, descriptions, and finding product information.
        </p>
        <p className="text-blue-700 text-sm">
          <strong>Google API Key & CSE ID:</strong> Enables accurate product search functionality to find purchase links and price information for inventory items.
        </p>
      </div>
    </div>
  );
};

export default ApiKeySettings;