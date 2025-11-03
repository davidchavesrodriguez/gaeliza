import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';

type Match = Database['public']['Tables']['matches']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

type MatchWithTeams = Match & {
  home_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  away_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
};

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('matches')
          .select(`
            *,
            home_team: home_team_id ( id, name, shield_url ),
            away_team: away_team_id ( id, name, shield_url )
          `)
          .eq('id', id)
          .single();

        if (fetchError) {
          throw fetchError;
        }
        
        setMatch(data);
      } catch (err: any) {
        console.error("Error cargando o partido:", err);
        setError("Non se puido atopar o partido.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400">
        Cargando datos do partido...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="my-4 p-4 bg-red-900 bg-opacity-50 text-red-300 rounded-md text-center">
          {error}
        </div>
        <div className="text-center mt-4">
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            &larr; Volver ao inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
       <div className="text-center py-10 text-gray-400">
        Partido non atopado.
       </div>
    );
  }

  const homeTeamName = match.home_team?.name || 'Equipo Local';
  const awayTeamName = match.away_team?.name || 'Equipo Visitante';
  const homeShield = match.home_team?.shield_url || `https://placehold.co/48x48/374151/FFF?text=${homeTeamName.charAt(0)}`;
  const awayShield = match.away_team?.shield_url || `https://placehold.co/48x48/374151/FFF?text=${awayTeamName.charAt(0)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/" className="text-sm text-blue-400 hover:text-blue-300">
          &larr; Volver a tódolos partidos
        </Link>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left">
            
            <div className="flex items-center gap-3 sm:gap-4 order-1 sm:order-1 mb-4 sm:mb-0">
              <img 
                src={homeShield} 
                alt={homeTeamName} 
                className="w-12 h-12 rounded-full object-cover bg-gray-600"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://placehold.co/48x48/374151/FFF?text=${homeTeamName.charAt(0)}`;
                  target.onerror = null; 
                }}
              />
              <span className="text-2xl font-bold text-white">{homeTeamName}</span>
            </div>

            <span className="text-xl text-gray-400 order-2 sm:order-2 mx-4">vs</span>
            
            <div className="flex items-center gap-3 sm:gap-4 order-3 sm:order-3 mt-4 sm:mt-0">
              <img 
                src={awayShield} 
                alt={awayTeamName} 
                className="w-12 h-12 rounded-full object-cover bg-gray-600"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://placehold.co/48x48/374151/FFF?text=${awayTeamName.charAt(0)}`;
                  target.onerror = null; 
                }}
              />
              <span className="text-2xl font-bold text-white">{awayTeamName}</span>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-6 pt-6 text-center sm:text-left">
            <h3 className="text-lg font-semibold text-white mb-3">Detalles do Partido</h3>
            <div className="space-y-2 text-gray-300">
              <p>
                <span className="font-medium text-gray-400 w-28 inline-block">Data:</span> 
                {new Date(match.match_date).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
              {match.competition && (
                <p>
                  <span className="font-medium text-gray-400 w-28 inline-block">Competición:</span> 
                  {match.competition}
                </p>
              )}
              {match.location && (
                <p>
                  <span className="font-medium text-gray-400 w-28 inline-block">Lugar:</span> 
                  {match.location}
                </p>
              )}
            </div>
          </div>
          
          {match.video_url && (
            <div className="border-t border-gray-700 mt-6 pt-6">
              <h3 className="text-lg font-semibold text-white mb-3">Vídeo</h3>
              <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                <iframe 
                  src={match.video_url.replace("watch?v=", "embed/")}
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Análise do Partido</h2>
        <p className="text-gray-400 mt-4">
          (Aquí irán as estatísticas, o campo interactivo para rexistrar accións, mapas de calor, etc.)
        </p>
      </div>

    </div>
  );
}