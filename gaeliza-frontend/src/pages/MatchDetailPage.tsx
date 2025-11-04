import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import AddPlayerModal from '../components/AddPlayerModal';
import ActionPanel, { type ActionType } from '../components/ActionPanel';
import LogActionModal from '../components/LogActionModal';

type Action = Database['public']['Tables']['actions']['Row'];
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
};
type Score = { goals: number, points: number, total: number };

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [homeParticipants, setHomeParticipants] = useState<ParticipantWithPlayer[]>([]);
  const [awayParticipants, setAwayParticipants] = useState<ParticipantWithPlayer[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  
  const [actions, setActions] = useState<Action[]>([]);
  const [setLoadingActions] = useState(true);
  const [score, setScore] = useState<{ home: Score, away: Score }>({
    home: { goals: 0, points: 0, total: 0 },
    away: { goals: 0, points: 0, total: 0 }
  });

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [modalTeam, setModalTeam] = useState<{ id: number; name: string } | null>(null);

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionToLog, setActionToLog] = useState<{ type: ActionType; teamId: number } | null>(null);

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
            away_team: teams!matches_away_team_id_fkey ( id, name, shield_url )
          `)
          .eq('id', Number(id))
          .single();
        if (fetchError) throw fetchError;
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
        console.error("Error cargando datos del partido:", err);
        setError("Erro ao cargar os datos do partido.");
      }
    };
    
    if (match && !showPlayerModal && !showActionModal) {
      fetchData();
    }
  }, [match, showPlayerModal, showActionModal]); 

  useEffect(() => {
    if (!match) return;

    const homeTeamId = match.home_team_id;
    const awayTeamId = match.away_team_id;

    let homeGoals = 0;
    let homePoints = 0;
    let awayGoals = 0;
    let awayPoints = 0;

    for (const action of actions) {
      if (action.team_id === homeTeamId) {
        if (action.type === 'gol') homeGoals++;
        if (action.type === 'punto') homePoints++;
      } else if (action.team_id === awayTeamId) {
        if (action.type === 'gol') awayGoals++;
        if (action.type === 'punto') awayPoints++;
      }
    }

    setScore({
      home: {
        goals: homeGoals,
        points: homePoints,
        total: (homeGoals * 3) + homePoints
      },
      away: {
        goals: awayGoals,
        points: awayPoints,
        total: (awayGoals * 3) + awayPoints
      }
    });

  }, [actions, match]);

  const handleOpenPlayerModal = (team: { id: number; name: string }) => {
    setModalTeam(team);
    setShowPlayerModal(true);
  };
  const handleClosePlayerModal = () => {
    setShowPlayerModal(false);
    setModalTeam(null);
  };
  const handleLogAction = (type: ActionType, teamId: number) => {
    setActionToLog({ type, teamId });
    setShowActionModal(true); 
  };

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

  if (!match || !match.home_team || !match.away_team) {
    return (
       <div className="text-center py-10 text-gray-400">
        Partido non atopado ou datos incompletos.
       </div>
    );
  }

  const homeTeamName = match.home_team.name;
  const awayTeamName = match.away_team.name;
  const homeShield = match.home_team.shield_url || `https://placehold.co/48x48/374151/FFF?text=${homeTeamName.charAt(0)}`;
  const awayShield = match.away_team.shield_url || `https://placehold.co/48x48/374151/FFF?text=${awayTeamName.charAt(0)}`;

  const AddPlayerButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full mt-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-white"
    >
      + Engadir Xogador
    </button>
  );

  const ParticipantList = ({ list }: { list: ParticipantWithPlayer[] }) => (
    <ul className="space-y-1 text-sm text-gray-300">
      {loadingParticipants ? (
        <li className="italic text-gray-500">Cargando...</li>
      ) : list.length === 0 ? (
        <li className="italic text-gray-500">Sen xogadores convocados.</li>
      ) : (
        list.map(p => (
          <li key={p.id} className="flex items-center justify-between p-1 rounded hover:bg-gray-700">
            <span>
              <span className="font-mono w-6 inline-block text-gray-400">
                {p.players?.number ? `${p.players.number}.` : '-'}
              </span>
              {p.players?.first_name} {p.players?.last_name}
            </span>
          </li>
        ))
      )}
    </ul>
  );

  const currentParticipants = modalTeam?.id === match.home_team_id
    ? homeParticipants
    : awayParticipants;

  const existingParticipantIds = currentParticipants.map(p => p.players?.id).filter(Boolean) as number[];

  const GaelicScore = ({ score }: { score: Score }) => (
    <span className="text-2xl font-bold text-white">
      {score.goals} - {score.points}
      <span className="text-lg text-gray-400 font-normal ml-1">({score.total})</span>
    </span>
  );

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
              <img src={homeShield} alt={homeTeamName} className="w-12 h-12 rounded-full object-cover bg-gray-600"/>
              <span className="text-2xl font-bold text-white hidden sm:inline">{homeTeamName}</span>
            </div>
            <div className="order-2 sm:order-2 mx-4 flex items-center gap-3">
              <GaelicScore score={score.home} />
              <span className="text-xl text-gray-400">vs</span>
              <GaelicScore score={score.away} />
            </div>
            <div className="flex items-center gap-3 sm:gap-4 order-3 sm:order-3 mt-4 sm:mt-0">
              <img src={awayShield} alt={awayTeamName} className="w-12 h-12 rounded-full object-cover bg-gray-600"/>
              <span className="text-2xl font-bold text-white hidden sm:inline">{awayTeamName}</span>
            </div>
          </div>
          <div className="flex sm:hidden justify-between mt-4 text-center">
            <span className="text-lg font-semibold text-white w-2/5 truncate">{homeTeamName}</span>
            <div className="w-1/5"></div>
            <span className="text-lg font-semibold text-white w-2/5 truncate">{awayTeamName}</span>
          </div>

        </div>
      </div>

      <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Análise do Partido</h2>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-3">Convocatoria (Opcional)</h3>
          <p className="text-sm text-gray-400 mb-4">
            Rexistra os xogadores que participaron para asignarlles accións.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-bold text-white mb-3">{homeTeamName}</h4>
              <ParticipantList list={homeParticipants} />
              <AddPlayerButton onClick={() => handleOpenPlayerModal({ id: match.home_team_id, name: homeTeamName })} />
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-bold text-white mb-3">{awayTeamName}</h4>
              <ParticipantList list={awayParticipants} />
              <AddPlayerButton onClick={() => handleOpenPlayerModal({ id: match.away_team_id, name: awayTeamName })} />
            </div>
          </div>
        </div>

        <ActionPanel 
          onLogAction={handleLogAction}
          homeTeamId={match.home_team_id}
          awayTeamId={match.away_team_id}
        />
      </div>

      {showPlayerModal && modalTeam && (
        <AddPlayerModal
          matchId={match.id}
          team={modalTeam}
          onClose={handleClosePlayerModal}
          existingParticipantIds={existingParticipantIds}
        />
      )}

      {showActionModal && actionToLog && match && (
        <LogActionModal
          matchId={match.id}
          actionToLog={actionToLog}
          participants={
            actionToLog.teamId === match.home_team_id 
              ? homeParticipants 
              : awayParticipants
          }
          onClose={() => setShowActionModal(false)}
        />
      )}

    </div>
  );
}