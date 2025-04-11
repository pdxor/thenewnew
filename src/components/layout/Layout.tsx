import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Leaf, User, LogOut, Settings, CheckSquare, Package, Menu, X, Mic, Users } from 'lucide-react';
import UniversalVoiceInput from '../common/UniversalVoiceInput';

const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [currentProject, setCurrentProject] = useState<{ id: string; title: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);

  // Add effect to detect project context from URL
  useEffect(() => {
    const checkProjectContext = async () => {
      const projectMatch = location.pathname.match(/\/projects\/([^\/]+)/);
      if (projectMatch && projectMatch[1]) {
        // Skip fetching if the path is /projects/new
        if (projectMatch[1] === 'new') {
          setCurrentProject(null);
          return;
        }

        // Validate UUID format using regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(projectMatch[1])) {
          setCurrentProject(null);
          return;
        }

        try {
          const { data: project, error } = await supabase
            .from('projects')
            .select('id, title')
            .eq('id', projectMatch[1])
            .single();
            
          if (error) throw error;
          if (project) {
            setCurrentProject(project);
          }
        } catch (err) {
          console.error('Error fetching project context:', err);
          setCurrentProject(null);
        }
      } else {
        setCurrentProject(null);
      }
    };

    checkProjectContext();
  }, [location.pathname]);

  // Handle logout
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    setLoading(true);
    try {
      await signOut();
      setShowUserMenu(false); // Close the menu
      setIsMobileMenuOpen(false); // Close mobile menu if open
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hide menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only close if click is outside both the menu and the button
      if (
        menuRef.current && 
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }

      // Handle mobile menu
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        hamburgerButtonRef.current &&
        !hamburgerButtonRef.current.contains(e.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    
    if (showUserMenu || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, isMobileMenuOpen]);

  // Close mobile menu when changing routes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Demo login using Supabase Auth
  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      // Demo credentials - in a real app, you would NEVER hardcode these
      const demoEmail = 'demo@example.com';
      const demoPassword = 'demodemo';

      // First check if demo account exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', demoEmail)
        .single();

      if (userError) {
        // Demo user doesn't exist yet, create one
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          // Create a profile for the demo user
          await supabase.from('profiles').insert({
            user_id: authData.user.id,
            name: 'Demo User',
            email: demoEmail,
            skills: ['Permaculture', 'Gardening', 'Sustainable Design'],
            joined_at: new Date().toISOString(),
          });
        }
      } else {
        // Demo user exists, just sign in
        const { error } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        
        if (error) throw error;
      }

      // Navigate to projects after successful login
      navigate('/projects');
    } catch (error) {
      console.error('Demo login error:', error);
      alert('Could not log in with demo account. Please try again or use regular login.');
    } finally {
      setDemoLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-700 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <Leaf className="h-6 w-6 mr-2" />
            <span>Permaculture Projects</span>
          </Link>
          
          {/* Mobile Menu Button */}
          <button 
            ref={hamburgerButtonRef}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            {!user ? (
              <>
                <button 
                  onClick={handleDemoLogin}
                  disabled={demoLoading}
                  className="bg-white text-green-700 px-4 py-2 rounded-md font-medium hover:bg-gray-100 disabled:opacity-70 flex items-center"
                >
                  {demoLoading ? (
                    <>
                      <div className="mr-2 h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                      Logging in...
                    </>
                  ) : (
                    'Demo: Login'
                  )}
                </button>
                <Link
                  to="/login"
                  className="text-white hover:text-green-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-white hover:text-green-200"
                >
                  Register
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/projects"
                  className={`px-3 py-1 rounded-md ${location.pathname.startsWith('/projects') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                >
                  Projects
                </Link>
                <Link
                  to="/tasks"
                  className={`px-3 py-1 rounded-md flex items-center ${location.pathname.startsWith('/tasks') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Tasks
                </Link>
                <Link
                  to="/inventory"
                  className={`px-3 py-1 rounded-md flex items-center ${location.pathname.startsWith('/inventory') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                >
                  <Package className="h-4 w-4 mr-1" />
                  Inventory
                </Link>
                <Link
                  to="/members"
                  className={`px-3 py-1 rounded-md flex items-center ${location.pathname.startsWith('/members') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Members
                </Link>
                <Link
                  to="/profile"
                  className={`px-3 py-1 rounded-md ${location.pathname.startsWith('/profile') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                >
                  Profile
                </Link>
                {user && (
                  <button
                    onClick={() => setShowVoiceInput(true)}
                    className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center"
                    title="Voice Input"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                )}
                <div className="relative inline-block">
                  <button 
                    ref={buttonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
                    className={`px-3 py-1 rounded-md ${location.pathname.startsWith('/settings') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  
                  {showUserMenu && (
                    <div 
                      ref={menuRef}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10"
                      onClick={(e) => e.stopPropagation()} // Prevent clicks inside menu from closing it
                    >
                      <div className="py-1">
                        <Link
                          to="/settings/api-keys"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          API Key Settings
                        </Link>
                        <div className="border-t border-gray-100"></div>
                        <button
                          onClick={handleLogout}
                          disabled={loading}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            <LogOut className="h-4 w-4 mr-2" />
                            {loading ? 'Logging out...' : 'Logout'}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* Mobile Menu */}
          <div 
            ref={mobileMenuRef}
            className={`fixed top-0 right-0 h-full w-64 bg-green-800 z-50 transform transition-transform duration-300 ease-in-out shadow-xl ${
              isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            } lg:hidden`}
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-white text-xl font-semibold">Menu</h2>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-white focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex flex-col space-y-4">
                {!user ? (
                  <>
                    <button 
                      onClick={handleDemoLogin}
                      disabled={demoLoading}
                      className="bg-white text-green-700 px-4 py-2 rounded-md font-medium hover:bg-gray-100 disabled:opacity-70 flex items-center justify-center"
                    >
                      {demoLoading ? (
                        <>
                          <div className="mr-2 h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                          Logging in...
                        </>
                      ) : (
                        'Demo: Login'
                      )}
                    </button>
                    <Link
                      to="/login"
                      className="text-white hover:text-green-200 py-2 block"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="text-white hover:text-green-200 py-2 block"
                    >
                      Register
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/projects"
                      className={`px-3 py-2 rounded-md w-full ${location.pathname.startsWith('/projects') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      Projects
                    </Link>
                    <Link
                      to="/tasks"
                      className={`px-3 py-2 rounded-md w-full flex items-center ${location.pathname.startsWith('/tasks') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Tasks
                    </Link>
                    <Link
                      to="/inventory"
                      className={`px-3 py-2 rounded-md w-full flex items-center ${location.pathname.startsWith('/inventory') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Inventory
                    </Link>
                    <Link
                      to="/members"
                      className={`px-3 py-2 rounded-md w-full flex items-center ${location.pathname.startsWith('/members') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Members
                    </Link>
                    <Link
                      to="/profile"
                      className={`px-3 py-2 rounded-md w-full ${location.pathname.startsWith('/profile') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      <User className="h-4 w-4 mr-2 inline" />
                      Profile
                    </Link>
                    <Link
                      to="/settings/api-keys"
                      className={`px-3 py-2 rounded-md w-full ${location.pathname.startsWith('/settings') ? 'bg-green-600' : 'hover:bg-green-600'}`}
                    >
                      <Settings className="h-4 w-4 mr-2 inline" />
                      API Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={loading}
                      className="w-full text-left px-3 py-2 text-white hover:bg-green-600 rounded-md"
                    >
                      <div className="flex items-center">
                        <LogOut className="h-4 w-4 mr-2" />
                        {loading ? 'Logging out...' : 'Logout'}
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Overlay for mobile menu */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
          )}
        </div>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        <Outlet />
        {showVoiceInput && (
          <UniversalVoiceInput 
            onClose={() => setShowVoiceInput(false)} 
            currentProject={currentProject}
          />
        )}
      </main>
      
      <footer className="bg-gray-800 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Link to="/" className="flex items-center">
                <Leaf className="h-6 w-6 mr-2" />
                <span className="text-xl font-bold">Permaculture Projects</span>
              </Link>
              <p className="text-gray-400 mt-2">Building sustainable communities together</p>
            </div>
            
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white">About</a>
              <a href="#" className="text-gray-400 hover:text-white">Resources</a>
              <a href="#" className="text-gray-400 hover:text-white">Contact</a>
              <a href="#" className="text-gray-400 hover:text-white">Privacy</a>
            </div>
          </div>
          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} Permaculture Projects. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;