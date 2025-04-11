import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Save, PlusCircle, X } from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const ProfileSetupForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [existingProfile, setExistingProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [location, setLocation] = useState('');
  const [shortTermMission, setShortTermMission] = useState('');
  const [longTermMission, setLongTermMission] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Check if profile already exists
  useEffect(() => {
    if (!user) return;

    const checkExistingProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          // Profile exists, populate the form with existing data
          setProfileExists(true);
          setExistingProfile(data);
          
          // Set form fields with existing data
          setName(data.name || '');
          setEmail(data.email || user.email || '');
          setLocation(data.location || '');
          setShortTermMission(data.short_term_mission || '');
          setLongTermMission(data.long_term_mission || '');
          setSkills(data.skills || []);
          setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        console.error('Error checking profile:', err);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkExistingProfile();
  }, [user]);

  const handleAddSkill = () => {
    if (newSkill.trim() !== '' && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAvatarFile(files[0]);
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setAvatarUrl(e.target.result as string);
        }
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return avatarUrl;
    
    try {
      // First check if the bucket exists
      const { data: buckets, error: bucketError } = await supabase
        .storage
        .listBuckets();
      
      if (bucketError) {
        console.error('Error checking buckets:', bucketError);
        setError('Error checking storage buckets. Please try again.');
        return null;
      }
      
      // Verify the 'profiles' bucket exists
      const profilesBucket = buckets.find(bucket => bucket.name === 'profiles');
      if (!profilesBucket) {
        console.error('Profiles bucket not found');
        setError('Storage bucket for avatars not found. Please contact support.');
        return null;
      }
      
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, avatarFile);
          
      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        setError('Failed to upload avatar. Please try again.');
        return null;
      }
      
      const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload avatar. Please try again.');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Upload avatar if selected
      let profileAvatarUrl = avatarUrl;
      if (avatarFile) {
        profileAvatarUrl = await uploadAvatar();
        
        if (!profileAvatarUrl && avatarFile) {
          throw new Error('Failed to upload avatar. Please try again without an avatar or try a different image.');
        }
      }
      
      if (profileExists) {
        // Update existing profile
        const profileData: ProfileUpdate = {
          name,
          email,
          location,
          short_term_mission: shortTermMission,
          long_term_mission: longTermMission,
          skills,
          avatar_url: profileAvatarUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id);
          
        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name,
            email,
            location,
            short_term_mission: shortTermMission,
            long_term_mission: longTermMission,
            skills,
            avatar_url: profileAvatarUrl,
            joined_at: new Date().toISOString()
          });
          
        if (insertError) {
          throw insertError;
        }
      }
      
      // Redirect to profile view
      navigate('/profile');
      
    } catch (err) {
      console.error('Error saving profile:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        <span className="ml-3 text-gray-600">Checking profile status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        {profileExists ? 'Complete Your Profile' : 'Create Your Profile'}
      </h1>
      <p className="text-gray-600 mb-6">
        {profileExists 
          ? 'Please complete your profile information to get the most out of Permaculture Projects.'
          : 'Please create your profile to get started with Permaculture Projects.'}
      </p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6 flex justify-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-32 h-32 rounded-full object-cover border-4 border-green-100"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                <UserCircle className="h-20 w-20 text-gray-400" />
              </div>
            )}
            <label htmlFor="avatar" className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full cursor-pointer hover:bg-green-700">
              <PlusCircle className="h-5 w-5" />
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="name">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!user?.email}
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            type="text"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2">
            Skills
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {skills.map((skill, index) => (
              <div 
                key={index}
                className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm flex items-center"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="ml-1 text-green-700 hover:text-green-900"
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
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill (e.g., Gardening, Permaculture Design)"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
            />
            <button
              type="button"
              className="px-4 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700"
              onClick={handleAddSkill}
            >
              Add
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="shortTermMission">
            Short-term Mission
          </label>
          <textarea
            id="shortTermMission"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={shortTermMission}
            onChange={(e) => setShortTermMission(e.target.value)}
            rows={3}
            placeholder="What are your short-term goals in permaculture?"
          ></textarea>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="longTermMission">
            Long-term Mission
          </label>
          <textarea
            id="longTermMission"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={longTermMission}
            onChange={(e) => setLongTermMission(e.target.value)}
            rows={3}
            placeholder="What is your long-term vision or mission in sustainable design?"
          ></textarea>
        </div>
        
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {profileExists ? 'Updating Profile...' : 'Creating Profile...'}
            </span>
          ) : (
            <span className="flex items-center">
              <Save className="h-5 w-5 mr-2" />
              {profileExists ? 'Update Profile' : 'Complete Profile Setup'}
            </span>
          )}
        </button>
      </form>
    </div>
  );
};

export default ProfileSetupForm;