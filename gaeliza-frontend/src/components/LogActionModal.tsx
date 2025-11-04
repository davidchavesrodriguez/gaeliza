import { useState, type FormEvent } from 'react';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import type { ActionType } from './ActionPanel'; 

type ActionInsert = Database['public']['Tables']['actions']['Insert'];
type Player = Database['public']['Tables']['players']['Row'];
type Participant = Database['public']['Tables']['match_participants']['Row'];
type ParticipantWithPlayer = Participant & {
  players: Pick<Player, 'id' | 'first_name' | 'last_name' | 'number'> | null
};

interface LogActionModalProps {
  matchId: number;
  actionToLog: { type: ActionType; teamId: number };
  participants: ParticipantWithPlayer[]; 
  onClose: () => void;
}

export default function LogActionModal({ matchId, actionToLog, participants, onClose }: LogActionModalProps) {
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [minute, setMinute] = useState<string>('');
  const [second, setSecond] = useState<string>('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (minute === '') {
        setError('O minuto é obrigatorio.');
        setLoading(false);
        return;
    }

    try {
      const actionToInsert: ActionInsert = {
        match_id: matchId,
        team_id: actionToLog.teamId,
        type: actionToLog.type,
        minute: parseInt(minute, 10),
        second: second === '' ? 0 : parseInt(second, 10),
        player_id: selectedPlayerId ? parseInt(selectedPlayerId, 10) : null,
      };

      const { error: insertError } = await supabase
        .from('actions')
        .insert(actionToInsert);

      if (insertError) throw insertError;

      onClose();

    } catch (err: any) {
      console.error("Error ao gardar a acción:", err);
      setError(err.message || 'Erro descoñecido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
        
        <h2 className="text-xl font-bold text-white mb-4">
          Rexistrar Acción: <span className="capitalize text-blue-400">{actionToLog.type.replace('_', ' ')}</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label htmlFor="player_select" className="block text-sm font-medium text-gray-300 mb-1">
              Xogador (Opcional)
            </label>
            <select
              id="player_select"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md"
            >
              <option value="">Acción de equipo (Sen xogador)</option>
              {participants.length === 0 && (
                <option disabled>Non hai xogadores convocados...</option>
              )}
              {participants.map(p => (
                <option key={p.id} value={p.players?.id}>
                  {p.players?.number ? `${p.players.number}. ` : ''}
                  {p.players?.first_name} {p.players?.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minute" className="block text-sm font-medium text-gray-300 mb-1">
                Minuto*
              </label>
              <input
                type="number"
                id="minute"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md"
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <label htmlFor="second" className="block text-sm font-medium text-gray-300 mb-1">
                Segundo (Opcional)
              </label>
              <input
                type="number"
                id="second"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md"
                placeholder="Ex: 30"
              />
            </div>
          </div>

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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Gardando...' : 'Gardar Acción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}