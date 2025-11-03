import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { Routes, Route, Navigate } from 'react-router-dom'; 

import Login from './components/Login';
import Dashboard from './components/Dashboard'; 
import MatchDetailPage from './pages/MatchDetailPage'; 

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
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

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-white animate-pulse">Verificando sesión...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      
      {session && user && (
        <header className="bg-gray-800 shadow-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-500">Gaeliza 🏐</h1>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <span className="text-gray-300 text-sm hidden md:block">Ola, {user.email}!</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white rounded-lg text-sm sm:text-base hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                Pechar sesión
              </button>
            </div>
          </div>
        </header>
      )}

      <Routes>
        {!session || !user ? (
          <Route path="/login" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/match/:id" element={<MatchDetailPage />} />
          </>
        )}
        
        <Route 
          path="*" 
          element={<Navigate to={!session ? "/login" : "/"} replace />} 
        />
      </Routes>

      {session && (
        <footer className="text-center text-xs text-gray-500 py-4 mt-8 border-t border-gray-700">
          Gaeliza - {new Date().getFullYear()}
        </footer>
      )}
    </div>
  );
}

export default App;