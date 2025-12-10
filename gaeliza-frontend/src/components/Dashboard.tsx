import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import MatchForm from './MatchForm';

type Match = Database['public']['Tables']['matches']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

// Tipo estendido para incluír datos das táboas relacionadas (JOINs)
type MatchWithDetails = Match & {
  home_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  away_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  owner: { username: string } | null;
};

/**
 * Compoñente Dashboard
 * Pantalla principal da aplicación. Mostra un panel con todos os partidos rexistrados,
 * con opcións de filtrado e busca.
 */
export default function Dashboard() {
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMine, setFilterMine] = useState(false);

  useEffect(() => {
    // 1. Obtemos o usuario actual para identificar a propiedade dos partidos
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();

    // 2. Cargamos a lista de partidos con datos relacionados
    const fetchMatches = async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            *,
            home_team: teams!matches_home_team_id_fkey ( id, name, shield_url ),
            away_team: teams!matches_away_team_id_fkey ( id, name, shield_url ),
            owner: profiles!fk_matches_profiles ( username )
          `)
          .order('match_date', { ascending: false });

        if (error) throw error;
        
        setMatches((data as any) || []);
        
      } catch (error) {
        console.error('Erro cargando partidos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [showCreateModal]);

  /**
   * Lóxica de filtrado de partidos baseada nos criterios do usuario.
   */
  const filteredMatches = matches.filter(match => {
    // 1. Filtro de texto
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      match.home_team?.name.toLowerCase().includes(term) ||
      match.away_team?.name.toLowerCase().includes(term) ||
      match.competition?.toLowerCase().includes(term) ||
      match.location?.toLowerCase().includes(term);

    // 2. Filtro de propiedade
    const matchesMine = filterMine ? match.created_by === currentUserId : true;

    return matchesSearch && matchesMine;
  });

  if (loading) return <div className="text-center py-10 text-gray-400">Cargando partidos...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Cabeceira e Botón de Creación */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">Panel de Partidos</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-lg shadow-blue-900/20 w-full sm:w-auto"
        >
          + Novo Partido
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4 items-center border border-gray-700">
        {/* Buscador */}
        <div className="relative w-full sm:flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar equipo, competición ou lugar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Toggle Partidos Propios*/}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterMine(!filterMine)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all border ${
              filterMine 
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-900/50 shadow-inner' 
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            {filterMine ? '★ Só os meus' : '☆ Tódolos partidos'}
          </button>
        </div>
      </div>

      {/* Grella de Partidos Filtrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMatches.map((match) => {
          const isMyMatch = currentUserId === match.created_by;

          // Clases dinámicas baseadas na propiedade do partido
          const cardClasses = isMyMatch
            ? 'bg-gray-800 border-blue-500/60 shadow-blue-900/20 hover:shadow-blue-500/30 hover:border-blue-400'
            : 'bg-gray-800/60 border-gray-700 hover:border-gray-600 hover:bg-gray-800';

          const headerClasses = isMyMatch 
            ? 'bg-blue-900/10' 
            : 'bg-gray-900/30';

          const footerClasses = isMyMatch
            ? 'bg-gray-900 border-blue-900/30'
            : 'bg-gray-900/50 border-gray-700';

          return (
            <Link to={`/match/${match.id}`} key={match.id} className="block group">
              <div className={`rounded-lg shadow-lg overflow-hidden border transition-all duration-300 ${cardClasses}`}>
                
                {/* Cabeceira da Tarxeta */}
                <div className={`p-4 flex justify-between items-center ${headerClasses}`}>
                  <span className={`text-xs font-mono ${isMyMatch ? 'text-blue-300' : 'text-gray-500'}`}>
                    {new Date(match.match_date).toLocaleDateString()}
                  </span>

                  {isMyMatch && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wide">
                      TEU PARTIDO
                    </span>
                  )}
                </div>

                {/* Contido Principal */}
                <div className="p-6 flex items-center justify-between">
                  {/* Equipo Local */}
                  <div className="flex flex-col items-center w-1/3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full mb-2 overflow-hidden flex items-center justify-center shadow-inner">
                      {match.home_team?.shield_url ? (
                        <img src={match.home_team.shield_url} alt={match.home_team.name} className="w-full h-full object-cover" />
                      ) : <span className="text-xl opacity-50">🏠</span>}
                    </div>
                    <span className="text-sm text-center text-gray-200 font-medium truncate w-full">{match.home_team?.name}</span>
                  </div>

                  <span className={`font-bold text-xl ${isMyMatch ? 'text-blue-500' : 'text-gray-600'}`}>VS</span>

                  {/* Equipo Visitante */}
                  <div className="flex flex-col items-center w-1/3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full mb-2 overflow-hidden flex items-center justify-center shadow-inner">
                      {match.away_team?.shield_url ? (
                        <img src={match.away_team.shield_url} alt={match.away_team.name} className="w-full h-full object-cover" />
                      ) : <span className="text-xl opacity-50">✈️</span>}
                    </div>
                    <span className="text-sm text-center text-gray-200 font-medium truncate w-full">{match.away_team?.name}</span>
                  </div>
                </div>

                {/* Pé da Tarxeta */}
                <div className={`px-4 py-3 border-t flex items-center justify-end ${footerClasses}`}>
                  <span className={`text-xs group-hover:underline ${isMyMatch ? 'text-blue-400 font-medium' : 'text-gray-500'}`}>
                    Ver detalles →
                  </span>
                </div>

              </div>
            </Link>
          );
        })}

        {/* Estado baleiro */}
        {filteredMatches.length === 0 && (
          <div className="col-span-full text-center py-16 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
            <p className="text-gray-400 mb-2">Non se atoparon partidos.</p>
            {(searchTerm || filterMine) ? (
              <button 
                onClick={() => { setSearchTerm(''); setFilterMine(false); }}
                className="text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Limpar filtros
              </button>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Sé o primeiro en crear un!
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de creación */}
      {showCreateModal && (
        <MatchForm 
          onMatchCreated={() => setShowCreateModal(false)} 
          onCancel={() => setShowCreateModal(false)} 
        />
      )}
    </div>
  );
}