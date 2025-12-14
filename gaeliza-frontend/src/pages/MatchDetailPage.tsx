import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import AddPlayerModal from '../components/AddPlayerModal';
import ActionPanel, { type ActionType } from '../components/ActionPanel';
import LogActionModal from '../components/LogActionModal';
import FloatingStopwatch from '../components/FloatingStopwatch';
import ActionFeed from '../components/ActionFeed';

// --- Definición de Tipos ---
type Player = Database['public']['Tables']['players']['Row'];
type Participant = Database['public']['Tables']['match_participants']['Row'];
type ParticipantWithPlayer = Participant & {
  players: Pick<Player, 'id' | 'first_name' | 'last_name' | 'number'> | null
};
type Match = Database['public']['Tables']['matches']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type MatchWithTeams = Match & {
  home_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  away_team: Pick<Team, 'id' | 'name' | 'shield_url'> | null;
  owner?: { username: string } | null;
};
type Action = Database['public']['Tables']['actions']['Row'];

/**
 * Extrae o ID dun video de YouTube dende unha URL estándar ou curta.
 */
const getYouTubeEmbedUrl = (url: string | null): string | null => {
  if (!url) return null;
  const regExp = new RegExp("(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^\"&?\\/\\s]{11})", "i");
  const m = url.match(regExp);
  return (m && m[1]) ? `https://www.youtube.com/embed/${m[1]}` : null;
};

/**
 * Compoñente de sección despregable para organizar a información da páxina.
 */
const CollapsibleSection = ({ 
  title, 
  children, 
  defaultOpen = false,
  visible = true 
}: { 
  title: string, 
  children: React.ReactNode, 
  defaultOpen?: boolean,
  visible?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!visible) return null;

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden mb-4 border border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex justify-between items-center bg-gray-900/50 hover:bg-gray-800 transition-colors text-left"
      >
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          {title}
        </h3>
        <span className={`text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isOpen && (
        <div className="p-6 border-t border-gray-700 animate-in fade-in slide-in-from-top-2">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Compoñente auxiliar para mostrar a lista de convocados dun equipo.
 * Admite estado de carga.
 */
const TeamParticipantList = ({ 
  list, 
  teamName, 
  teamId, 
  isOwner, 
  isLoading,
  onManage 
}: { 
  list: ParticipantWithPlayer[], 
  teamName: string, 
  teamId: number, 
  isOwner: boolean, 
  isLoading: boolean,
  onManage: (team: { id: number, name: string }) => void 
}) => (
  <div className="bg-gray-900 p-4 rounded-lg">
    <h4 className="font-bold text-white mb-3 border-b border-gray-700 pb-2">{teamName}</h4>
    
    {isLoading ? (
      <div className="text-sm text-gray-500 italic py-2 animate-pulse">Cargando xogadores...</div>
    ) : (
      <ul className="space-y-1 text-sm text-gray-300 mb-4">
        {list.length === 0 ? (
          <li className="italic text-gray-500">Sen convocatoria.</li>
        ) : (
          list.map(p => (
            <li key={p.id} className="flex justify-between p-1 hover:bg-gray-800 rounded">
              <span>
                <span className="font-mono text-gray-500 w-6 inline-block">{p.players?.number || '-'}</span>
                {p.players?.first_name} {p.players?.last_name}
              </span>
            </li>
          ))
        )}
      </ul>
    )}

    {isOwner && (
      <button
        onClick={() => onManage({ id: teamId, name: teamName })}
        className="w-full py-2 text-sm bg-blue-600/20 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600 hover:text-white transition-all"
        disabled={isLoading}
      >
        + Xestionar
      </button>
    )}
  </div>
);

/**
 * Páxina principal de Detalle do Partido.
 * Centraliza a lóxica de visualización, cronometraxe e rexistro de eventos.
 * Xestiona o estado global do partido e coordina os compoñentes fillos.
 */
export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  // Estados de datos principais
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [homeParticipants, setHomeParticipants] = useState<ParticipantWithPlayer[]>([]);
  const [awayParticipants, setAwayParticipants] = useState<ParticipantWithPlayer[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  
  // Estados de interface e carga
  const [loading, setLoading] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados dos modais
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [modalTeam, setModalTeam] = useState<{ id: number; name: string } | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionToLog, setActionToLog] = useState<{ type: ActionType; teamId: number; capturedTime: number } | null>(null);

  // Estados do cronómetro
  const [gameTime, setGameTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Estado de usuario (Seguridade)
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 1. Carga de usuario para verificación de permisos
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // 2. Lóxica do cronómetro
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setGameTime(prev => prev + 1);
      }, 1000);
    } else if (!isTimerRunning && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // 3. Carga inicial do partido
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
            home_team: teams!matches_home_team_id_fkey ( id, name, shield_url ),
            away_team: teams!matches_away_team_id_fkey ( id, name, shield_url ),
            owner: profiles!fk_matches_profiles ( username )
          `)
          .eq('id', Number(id))
          .single();
        
        if (fetchError) throw fetchError;
        setMatch(data as any); 
      } catch (err: any) {
        console.error("Erro cargando o partido:", err);
        setError("Non se puido atopar o partido.");
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [id]);

  // 4. Carga de datos de participantes e accións)
  useEffect(() => {
    const fetchData = async () => {
      if (!match) return;
      setLoadingParticipants(true);
      setLoadingActions(true);
      try {
        const { data: participantsData, error: participantsError } = await supabase
          .from('match_participants')
          .select(`*, players ( id, first_name, last_name, number )`)
          .eq('match_id', match.id);
        
        if (participantsError) throw participantsError;
        
        setHomeParticipants(
          participantsData.filter(p => p.team_id === match.home_team_id) as ParticipantWithPlayer[]
        );
        setAwayParticipants(
          participantsData.filter(p => p.team_id === match.away_team_id) as ParticipantWithPlayer[]
        );
        setLoadingParticipants(false);

        const { data: actionsData, error: actionsError } = await supabase
          .from('actions')
          .select('*')
          .eq('match_id', match.id);
        
        if (actionsError) throw actionsError;
        
        setActions(actionsData || []);
        setLoadingActions(false);

      } catch (err: any) {
        console.error("Erro cargando datos:", err);
        setError("Erro ao cargar os datos do partido.");
      }
    };
    
    if (match && !showPlayerModal && !showActionModal) {
      fetchData();
    }
  }, [match, showPlayerModal, showActionModal]);

  // 5. Cálculo do marcador
  const score = useMemo(() => {
    if (!match) return { home: { goals: 0, points: 0, total: 0 }, away: { goals: 0, points: 0, total: 0 } };

    let homeGoals = 0, homePoints = 0, awayGoals = 0, awayPoints = 0;
    
    actions.forEach(action => {
      if (action.team_id === match.home_team_id) {
        if (action.type === 'gol') homeGoals++;
        if (action.type === 'punto') homePoints++;
      } else if (action.team_id === match.away_team_id) {
        if (action.type === 'gol') awayGoals++;
        if (action.type === 'punto') awayPoints++;
      }
    });

    return {
      home: { goals: homeGoals, points: homePoints, total: (homeGoals * 3) + homePoints },
      away: { goals: awayGoals, points: awayPoints, total: (awayGoals * 3) + awayPoints }
    };
  }, [actions, match]);

  // --- Manexadores de eventos ---

  const handleDeleteAction = async (actionId: number) => {
    try {
      const { error } = await supabase.from('actions').delete().eq('id', actionId);
      if (error) throw error;
      setActions(prev => prev.filter(a => a.id !== actionId));
    } catch (err) {
      console.error("Erro borrando acción:", err);
      alert("Non se puido borrar a acción.");
    }
  };

  const handleOpenPlayerModal = (team: { id: number; name: string }) => {
    setModalTeam(team);
    setShowPlayerModal(true);
  };

  const handleLogAction = (type: ActionType, teamId: number) => {
    setActionToLog({ type, teamId, capturedTime: gameTime });
    setShowActionModal(true); 
  };

  // --- Renderizado ---

  const isOwner = match && currentUser && match.created_by === currentUser.id;

  if (loading) return <div className="text-center py-10 text-gray-400">Cargando datos...</div>;
  if (error) return <div className="text-center py-10 text-red-400">{error} <Link to="/dashboard" className="underline ml-2">Volver</Link></div>;
  if (!match || !match.home_team || !match.away_team) return null;

  const homeTeamName = match.home_team.name;
  const awayTeamName = match.away_team.name;
  const homeShield = match.home_team.shield_url || `https://placehold.co/48x48/374151/FFF?text=${homeTeamName.charAt(0)}`;
  const awayShield = match.away_team.shield_url || `https://placehold.co/48x48/374151/FFF?text=${awayTeamName.charAt(0)}`;
  const embedUrl = getYouTubeEmbedUrl(match.video_url);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
      
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          <span>←</span> Volver
        </Link>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6 mb-6 border-b-4 border-blue-600">
        <div className="flex flex-col sm:flex-row justify-between items-center text-center">
          
          <div className="flex items-center gap-4 mb-4 sm:mb-0 w-1/3 justify-start">
            <img src={homeShield} alt={homeTeamName} className="w-16 h-16 rounded-full object-cover bg-gray-700 ring-2 ring-gray-600"/>
            <span className="text-xl sm:text-2xl font-bold text-white hidden sm:block truncate">{homeTeamName}</span>
          </div>

          <div className="flex flex-col items-center mx-4 bg-gray-900/50 px-6 py-3 rounded-xl border border-gray-700">
            <div className="text-3xl sm:text-5xl font-mono font-bold text-white tracking-widest flex items-center gap-4">
              <span>{score.home.total}</span>
              <span className="text-gray-600 text-2xl">-</span>
              <span>{score.away.total}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">
              {score.home.goals}-{score.home.points} <span className="mx-2 text-gray-600">|</span> {score.away.goals}-{score.away.points}
            </div>
            <div className="mt-2 px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded border border-green-900/50">
              {isOwner ? 'MODO EDICIÓN' : 'MODO ESPECTADOR'}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 sm:mt-0 w-1/3 justify-end">
            <span className="text-xl sm:text-2xl font-bold text-white hidden sm:block truncate text-right">{awayTeamName}</span>
            <img src={awayShield} alt={awayTeamName} className="w-16 h-16 rounded-full object-cover bg-gray-700 ring-2 ring-gray-600"/>
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN DE DETALLES */}
      <CollapsibleSection title="ℹ️ Detalles do Partido" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
          <div className="space-y-2">
            <p><span className="text-gray-500 w-24 inline-block">Data:</span> {new Date(match.match_date).toLocaleString()}</p>
            <p><span className="text-gray-500 w-24 inline-block">Lugar:</span> {match.location || 'Sen especificar'}</p>
            <p><span className="text-gray-500 w-24 inline-block">Liga:</span> {match.competition || 'Amigable'}</p>
            <p><span className="text-gray-500 w-24 inline-block">Creador:</span> {match.owner?.username || 'Descoñecido'}</p>
          </div>
          {embedUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Video Resumen" />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 3. PANEL DE ACCIÓNS */}
      <CollapsibleSection title="🎮 Panel de Control" defaultOpen={true} visible={!!isOwner}>
        <ActionPanel 
          onLogAction={handleLogAction}
          homeTeamId={match.home_team_id}
          awayTeamId={match.away_team_id}
        />
      </CollapsibleSection>

      {/* 4. CONVOCATORIA */}
      <CollapsibleSection title="📋 Convocatoria" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TeamParticipantList 
            list={homeParticipants} 
            teamName={homeTeamName} 
            teamId={match.home_team_id} 
            isOwner={!!isOwner}
            isLoading={loadingParticipants}
            onManage={handleOpenPlayerModal}
          />
          <TeamParticipantList 
            list={awayParticipants} 
            teamName={awayTeamName} 
            teamId={match.away_team_id} 
            isOwner={!!isOwner}
            isLoading={loadingParticipants}
            onManage={handleOpenPlayerModal}
          />
        </div>
      </CollapsibleSection>

      {/* 5. HISTORIAL E INFORMES */}
      <CollapsibleSection title="📜 Rexistro de Eventos" defaultOpen={true}>
        {loadingActions ? (
          <div className="text-center text-gray-500 italic py-8 animate-pulse">Cargando eventos do partido...</div>
        ) : (
          <ActionFeed 
            actions={actions}
            homeTeamId={match.home_team_id}
            awayTeamId={match.away_team_id}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            participants={[...homeParticipants, ...awayParticipants]}
            onDeleteAction={handleDeleteAction}
            readOnly={!isOwner}
          />
        )}
      </CollapsibleSection>

      {/* 6. CRONÓMETRO */}
      {isOwner && (
        <FloatingStopwatch 
          time={gameTime}
          isRunning={isTimerRunning}
          onToggle={() => setIsTimerRunning(!isTimerRunning)}
          onReset={() => { setIsTimerRunning(false); setGameTime(0); }}
          onAdjust={(s) => setGameTime(prev => Math.max(0, prev + s))}
        />
      )}

      {/* MODALES DE XESTIÓN */}
      {isOwner && showPlayerModal && modalTeam && (
        <AddPlayerModal
          matchId={match.id}
          team={modalTeam}
          onClose={() => setShowPlayerModal(false)}
          existingParticipantIds={modalTeam.id === match.home_team_id 
            ? homeParticipants.map(p => p.player_id) 
            : awayParticipants.map(p => p.player_id)
          }
        />
      )}

      {isOwner && showActionModal && actionToLog && (
        <LogActionModal
          matchId={match.id}
          actionToLog={actionToLog}
          initialTime={actionToLog.capturedTime}
          participants={actionToLog.teamId === match.home_team_id ? homeParticipants : awayParticipants}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          onClose={() => setShowActionModal(false)}
        />
      )}

    </div>
  );
}