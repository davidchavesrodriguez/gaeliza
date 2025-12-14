import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import MatchForm from './MatchForm';

// --- TIPOS ---
type Match = Database['public']['Tables']['matches']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

type MatchWithDetails = Match & {
  home_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  away_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  owner: { username: string } | null;
};

// Tarjeta
const MatchAnalysisCard = ({ match, currentUserId }: { match: MatchWithDetails, currentUserId: string | null }) => {
  const isMine = match.created_by === currentUserId;
  const dateObj = new Date(match.match_date);

  return (
    <Link 
      to={`/match/${match.id}`} 
      className={`
        group block rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg
        bg-gray-800 
        border
        ${isMine 
          ? 'border-indigo-500/50 shadow-indigo-900/10 ring-1 ring-indigo-500/20 hover:border-white' 
          : 'border-gray-700 hover:border-white'
        }
      `}
    >
      <div className={`px-4 py-3 flex justify-between items-center text-xs border-b ${
        isMine 
          ? 'bg-indigo-900/20 border-indigo-500/30' 
          : 'bg-gray-900/40 border-gray-700'
      }`}>
        <span className="text-blue-400 font-bold uppercase tracking-wider truncate max-w-[60%]">
          {match.competition || 'Amigable'}
        </span>
        <span className="text-gray-400 font-mono font-medium">
          {dateObj.toLocaleDateString()}
        </span>
      </div>

      <div className="p-5 flex items-center justify-between relative">
        
        <div className="flex flex-col items-center w-1/3 space-y-3">
          <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
             {match.home_team?.shield_url ? (
                <img src={match.home_team.shield_url} alt="Local" className="w-full h-full object-contain" />
             ) : <span className="text-2xl opacity-40 grayscale">🏠</span>}
          </div>
          <span className="text-sm font-bold text-gray-100 text-center leading-tight line-clamp-2 min-h-[2.5em] flex items-center justify-center">
            {match.home_team?.name || 'Local'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center w-1/3 z-10">
          {isMine && (
            <span className="absolute top-0 -translate-y-1/2 bg-indigo-900 text-indigo-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-700 tracking-wide">
              CREADO POR TI
            </span>
          )}
          
          <div className="flex flex-col items-center gap-1">
             <span className="text-2xl font-black text-gray-700 select-none">VS</span>
          </div>
        </div>

        <div className="flex flex-col items-center w-1/3 space-y-3">
          <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
             {match.away_team?.shield_url ? (
                <img src={match.away_team.shield_url} alt="Visitante" className="w-full h-full object-contain" />
             ) : <span className="text-2xl opacity-40 grayscale">✈️</span>}
          </div>
          <span className="text-sm font-bold text-gray-100 text-center leading-tight line-clamp-2 min-h-[2.5em] flex items-center justify-center">
            {match.away_team?.name || 'Visitante'}
          </span>
        </div>
      </div>

      <div className="px-4 py-2 bg-gray-900/30 border-t border-gray-700/50 flex justify-between items-center text-[10px] text-gray-400">
         <span className="flex items-center gap-1 truncate max-w-[70%]">
            📍 {match.location || 'Non definida'}
         </span>
         {match.owner && !isMine && (
           <span className="italic opacity-70">{match.owner.username}</span>
         )}
      </div>
    </Link>
  );
};

const groupMatchesByMonth = (matches: MatchWithDetails[]) => {
  const groups: Record<string, MatchWithDetails[]> = {};
  const mesesGalego = ['Xaneiro', 'Febreiro', 'Marzo', 'Abril', 'Maio', 'Xuño', 'Xullo', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Decembro'];

  matches.forEach(match => {
    const date = new Date(match.match_date);
    const key = `${mesesGalego[date.getMonth()]} ${date.getFullYear()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(match);
  });
  return groups;
};

export default function Dashboard() {
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMine, setFilterMine] = useState(false);

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data, error } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), owner:profiles!fk_matches_profiles(username)`)
        .order('match_date', { ascending: false });

      if (!error && data) setMatches(data as any);
      setLoading(false);
    };
    initData();
  }, [showCreateModal]);

  const groupedMatches = useMemo(() => {
    const filtered = matches.filter(match => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        match.home_team?.name.toLowerCase().includes(term) ||
        match.away_team?.name.toLowerCase().includes(term) ||
        match.competition?.toLowerCase().includes(term) ||
        match.location?.toLowerCase().includes(term);
      const matchesMine = filterMine ? match.created_by === currentUserId : true;
      return matchesSearch && matchesMine;
    });
    return groupMatchesByMonth(filtered);
  }, [matches, searchTerm, filterMine, currentUserId]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        
        <div className="top-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 shadow-sm mb-8 pt-6 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 transition-colors">

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>+ Rexistrar novo partido</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">🔍</span>
              <input
                type="text"
                placeholder="Buscar equipo, liga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
              />
            </div>

            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center justify-center gap-2 ${
                filterMine 
                  ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                  : 'bg-indigo-900/30 text-indigo-300 border-indigo-700' 
              }`}
            >
              {filterMine ? '☆ Ver tódolos partidos' : '★ Ver só os meus partidos'}
            </button>
          </div>

        {/* LISTADO DE PARTIDOS */}
        {loading ? (
          <div className="text-center py-20 animate-pulse">
            <div className="w-12 h-12 bg-gray-800 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.keys(groupedMatches).length === 0 ? (
              <div className="text-center py-16 bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-700">
                <p className="text-gray-400 mb-2 text-lg">Non se atoparon partidos.</p>
                {(searchTerm || filterMine) && (
                  <button 
                    onClick={() => { setSearchTerm(''); setFilterMine(false); }}
                    className="text-blue-400 font-medium hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              Object.keys(groupedMatches).map((monthKey) => (
                <div key={monthKey} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  <div className="flex items-center gap-4 mb-6"> 
                    <h3 className="text-lg font-bold text-gray-200 capitalize bg-gray-900 px-2 rounded">
                      {monthKey}
                    </h3>
                    <div className="h-px bg-gray-800 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupedMatches[monthKey].map((match) => (
                      <MatchAnalysisCard key={match.id} match={match} currentUserId={currentUserId} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {showCreateModal && (
          <MatchForm 
            onMatchCreated={() => setShowCreateModal(false)} 
            onCancel={() => setShowCreateModal(false)} 
          />
        )}
      </div>
    </div>
  );
}