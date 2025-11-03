import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import type { Session, User } from '@supabase/supabase-js'; 
import MatchForm from './MatchForm';
import { Link } from 'react-router-dom'; 

type Match = Database['public']['Tables']['matches']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type MatchWithTeams = Match & {
  home_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  away_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
};

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [loadingData, setLoadingData] = useState(true);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showMatchForm, setShowMatchForm] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoadingData(true);
    setFetchError(null);
    try {
      const { data, error, status } = await supabase
        .from('matches')
        .select(`
          *,
          home_team: home_team_id ( id, name, shield_url ),
          away_team: away_team_id ( id, name, shield_url )
        `)
        .order('match_date', { ascending: false }); 

      if (error && status !== 406) { 
        console.error("Supabase fetch error details:", error);
        throw new Error(`Error ${error.code}: ${error.message}. ${error.hint ? `Hint: ${error.hint}` : ''}`);
      }

      if (data) {
        setMatches(data);
      } else {
        setMatches([]);
      }
    } catch (error: any) {
      console.error('Error cargando partidos:', error);
      setFetchError('Ups! Non se puideron cargar os partidos');
    } finally {
      setLoadingData(false);
    }
  };

  const handleNewMatchClick = () => setShowMatchForm(true);
  const handleFormCancel = () => setShowMatchForm(false);
  const handleMatchCreated = () => {
    setShowMatchForm(false); 
    loadMatches(); 
  };

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Últimos Partidos</h2>
            <button
              onClick={handleNewMatchClick} 
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              + Rexistrar novo partido
            </button>
          </div>

          {loadingData && (
            <div className="text-center py-4 text-gray-400">Cargando partidos...</div>
          )}

          {fetchError && !loadingData && (
            <div className="my-4 p-4 bg-red-900 bg-opacity-50 text-red-300 rounded-md text-center">
              {fetchError}
            </div>
          )}

          {!loadingData && !fetchError && matches.length === 0 && (
            <p className="text-gray-400 text-center py-6">Todavía no has registrado ningún partido. ¡Anímate a añadir el primero!</p>
          )}

          {!loadingData && !fetchError && matches.length > 0 && (
            <div className="space-y-4">
              {matches.map((match) => (
                <Link 
                  to={`/match/${match.id}`} 
                  key={match.id}
                  className="block border border-gray-700 rounded-lg p-4 hover:shadow-lg hover:bg-gray-700/[0.5] transition-all duration-200 ease-in-out group"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div className="mb-3 sm:mb-0 flex-grow">
                      <p className="font-semibold text-lg text-blue-400 flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className="flex items-center">
                          <img
                            src={match.home_team?.shield_url || `https://placehold.co/24x24/374151/FFF?text=${match.home_team?.name?.charAt(0) ?? 'L'}`}
                            alt={match.home_team?.name ?? 'Local'}
                            className="w-6 h-6 rounded-full object-cover mr-2 flex-shrink-0 bg-gray-600" 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `https://placehold.co/24x24/374151/FFF?text=${match.home_team?.name?.charAt(0) ?? 'L'}`;
                              target.onerror = null; 
                             }}
                          />
                          <span>{match.home_team?.name || 'Equipo Local'}</span>
                        </span>
                        <span className="text-gray-400 text-sm mx-1">vs</span>
                        <span className="flex items-center">
                           <img
                             src={match.away_team?.shield_url || `https://placehold.co/24x24/374151/FFF?text=${match.away_team?.name?.charAt(0) ?? 'V'}`}
                             alt={match.away_team?.name ?? 'Visitante'}
                             className="w-6 h-6 rounded-full object-cover mr-2 flex-shrink-0 bg-gray-600"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://placehold.co/24x24/374151/FFF?text=${match.away_team?.name?.charAt(0) ?? 'V'}`;
                                target.onerror = null;
                              }}
                           />
                           <span>{match.away_team?.name || 'Equipo Visitante'}</span>
                        </span>
                      </p>
                      <p className="text-sm text-gray-300 mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span className="flex items-center"><span className="mr-1">🗓️</span> {new Date(match.match_date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {match.location && <span className="flex items-center"><span className="mr-1">📍</span> {match.location}</span>}
                      </p>
                    </div>
                    {match.competition && (
                      <span className="self-start sm:self-center mt-2 sm:mt-0 px-3 py-1 bg-gray-600 text-gray-200 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
                        {match.competition}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
      </main>

      {showMatchForm && (
        <MatchForm
          onMatchCreated={handleMatchCreated}
          onCancel={handleFormCancel}       
        />
      )}
    </>
  );
}