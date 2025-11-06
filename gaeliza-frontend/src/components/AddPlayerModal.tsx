import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';

type Player = Database['public']['Tables']['players']['Row'];

interface AddPlayerModalProps {
  matchId: number;
  team: { id: number; name: string };
  onClose: () => void;
  existingParticipantIds: number[]; 
}

export default function AddPlayerModal({ matchId, team, onClose, existingParticipantIds }: AddPlayerModalProps) {
  
  const [mode, setMode] = useState<'select' | 'create'>('select');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  const [newPlayerData, setNewPlayerData] = useState({
    first_name: '',
    last_name: '',
    number: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlayers = async () => {
      setLoadingPlayers(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', team.id)
          .order('first_name', { ascending: true });

        if (error) throw error;
        setPlayers(data || []);
      } catch (err: any) {
        setError('Non se puideron cargar os xogadores do equipo.');
      } finally {
        setLoadingPlayers(false);
      }
    };
    loadPlayers();
  }, [team.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let playerToAddId: number;

      if (mode === 'create') {
        if (!newPlayerData.first_name || !newPlayerData.last_name) {
          throw new Error('O nome e os apelidos son obrigatorios.');
        }

        const { data: newPlayer, error: createPlayerError } = await supabase
          .from('players')
          .insert({
            first_name: newPlayerData.first_name,
            last_name: newPlayerData.last_name,
            "number": newPlayerData.number === '' ? null : parseInt(newPlayerData.number, 10),
            team_id: team.id,
            type: 'temporal' 
          })
          .select('id')
          .single();
        
        if (createPlayerError) throw createPlayerError;
        if (!newPlayer) throw new Error('Non se puido crear o xogador');
        
        playerToAddId = newPlayer.id;

      } else {
        if (!selectedPlayerId) {
          throw new Error('Debes seleccionar un xogador.');
        }
        playerToAddId = parseInt(selectedPlayerId, 10);
      }

      const { error: participantError } = await supabase
        .from('match_participants')
        .insert({
          match_id: matchId,
          team_id: team.id,
          player_id: playerToAddId
        });

      if (participantError) throw participantError;

      onClose(); 

    } catch (err: any) {
      console.error("Error ao engadir participante:", err);
      if (err.code === '23505') { 
        setError('Este xogador xa está na convocatoria.');
      } else {
        setError(err.message || 'Erro descoñecido.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleNewPlayerFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewPlayerData(prev => ({ ...prev, [name]: value }));
  };

  const availablePlayers = players.filter(p => !existingParticipantIds.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          Engadir Xogador a <span className="text-blue-400">{team.name}</span>
        </h2>

        <div className="flex mb-4 border-b border-gray-700">
          <button
            onClick={() => setMode('select')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'select' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Seleccionar Existente
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'create' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Crear Novo (Temporal)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'select' && (
            <div className="space-y-4">
              <label htmlFor="player_select" className="block text-sm font-medium text-gray-300">
                Xogadores dispoñibles
              </label>
              <select
                id="player_select"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                required
                disabled={loadingPlayers}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md"
              >
                <option value="" disabled>{loadingPlayers ? 'Cargando...' : 'Selecciona...'}</option>
                
                {availablePlayers.length === 0 && !loadingPlayers && (
                  <option disabled>Non hai máis xogadores dispoñibles</option>
                )}

                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">O xogador crearase como 'temporal' neste equipo.</p>
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-300">Nome*</label>
                <input type="text" name="first_name" id="first_name" value={newPlayerData.first_name} onChange={handleNewPlayerFormChange} required className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md" />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-300">Apelidos*</label>
                <input type="text" name="last_name" id="last_name" value={newPlayerData.last_name} onChange={handleNewPlayerFormChange} required className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md" />
              </div>
              <div>
                <label htmlFor="number" className="block text-sm font-medium text-gray-300">Dorsal (Opcional)</label>
                <input type="number" name="number" id="number" value={newPlayerData.number} onChange={handleNewPlayerFormChange} className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md" />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'select' && !selectedPlayerId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Gardando...' : 'Engadir Xogador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}