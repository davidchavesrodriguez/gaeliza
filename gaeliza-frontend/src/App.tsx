import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

import Login from './components/Login';
import Dashboard from './components/Dashboard'; 
import MatchDetailPage from './pages/MatchDetailPage'; 
import LandingPage from './pages/LandingPage'; 

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const location = useLocation();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoadingInitial(false);
    }).catch(error => {
      console.error("Error getting initial session:", error);
      setLoadingInitial(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, changedSession) => {
        setSession(changedSession);
        setUser(changedSession?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error ao pechar sesión:', error);
    }
  };

  const getDisplayName = () => {
    if (!user) return '';
    if (user.user_metadata?.username) return user.user_metadata.username;
    if (user.email) return user.email.split('@')[0];
    return 'Usuario';
  };

  const getInitial = () => {
    const name = getDisplayName();
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-white animate-pulse">Verificando sesión...</div>
      </div>
    );
  }

  const showAppChrome = session && user && location.pathname !== '/' && location.pathname !== '/login';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans z-50 flex flex-col">
      
      {/* HEADER */}
      {showAppChrome && (
        <header className="bg-gray-800 shadow-lg sticky top-0 z-50 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <Link to="/dashboard" className="group flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl">🏐</span>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                Gaeliza
              </h1>
            </Link>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-3 bg-gray-900/50 py-1.5 px-3 rounded-full border border-gray-700">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                  {getInitial()}
                </div>
                <span className="text-gray-300 text-sm font-medium">
                  {getDisplayName()}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600/90 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-95"
              >
                Pechar sesión
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-grow">
        <Routes>
          {/* Ruta Pública: Landing Page */}
          <Route path="/" element={<LandingPage session={session} />} />

          <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
          
          <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
          
          <Route path="/match/:id" element={session ? <MatchDetailPage /> : <Navigate to="/login" replace />} />
          
          {/* Fallback */}
          <Route 
            path="*" 
            element={<Navigate to="/" replace />} 
          />
        </Routes>
      </main>

      {/* FOOTER */}
      {showAppChrome && (
        <footer className="bg-gray-900 text-center py-8 mt-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} Gaeliza. <span className="text-gray-400 font-medium">Licenza MIT</span>
              </div>
              
              <div className="flex space-x-6">
                
                <a 
                  href="https://github.com/davidchavesrodriguez/gaeliza" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-500 hover:text-white transition-colors transform hover:scale-110"
                  aria-label="GitHub Repo"
                  title="Repositorio do Proxecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36.5-8 0C6.72 2 2 4 2 6c-.28 1.15-.28 2.35 0 3.5A5.403 5.403 0 0 0 1 13c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                    <path d="M9 18c-4.51 2-5-2-7-2"/>
                  </svg>
                </a>

                <a 
                  href="https://www.linkedin.com/in/chaves19/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-500 hover:text-blue-400 transition-colors transform hover:scale-110"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect width="4" height="12" x="2" y="9"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                </a>

                <a 
                  href="mailto:19.dchaves@gmail.com" 
                  className="text-gray-500 hover:text-red-400 transition-colors transform hover:scale-110"
                  aria-label="Email"
                  title="Contactar por correo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </a>

              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;