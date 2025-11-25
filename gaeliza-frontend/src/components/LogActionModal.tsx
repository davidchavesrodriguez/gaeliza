import { useState, type FormEvent } from 'react';
import { supabase } from '../supabaseClient';
import type { Database } from '../types/supabase';
import type { ActionType } from './ActionPanel';
import InteractivePitch from './InteractivePitch';

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
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
}

const SUBTYPE_OPTIONS: Partial<Record<ActionType, { label: string, options: string[] }>> = {
  'gol': {
    label: 'Como foi? (Opcional)',
    options: ['pé', 'man', 'penalti', 'tiro_libre', '45_metros']
  },
  'punto': {
    label: 'Como foi? (Opcional)',
    options: ['pé', 'man', 'penalti', 'tiro_libre', '45_metros']
  },
  'tiro_fallado': {
    label: 'Tipo de fallo (Opcional)',
    options: ['wide(fóra)', 'poste', 'curto', 'bloqueado/parado']
  },
  'perdida_balon': {
    label: 'Causa (Opcional)',
    options: ['mal_pase', 'mal_bote', 'mala_condución', 'pasos', '1+1', 'sen_distancia_13m', 'falta_ataque']
  },
  'balon_ganado': {
    label: 'Tipo (Opcional)',
    options: ['throw_in', 'xogada_aberta']
  },
  'recuperacion': {
    label: 'Tipo (Opcional)',
    options: ['intercepción_pase', 'roubo_directo']
  },
  'falta_cometida': {
    label: 'Tipo de Falta (Opcional)',
    options: ['golpeo', 'agarrón', 'mal_pickup', 'entrada_pé', 'obstrucción', 'protesta', 'bloqueo_ilegal'] 
  },
  'penalti_cometido': {
    label: 'Causa (Opcional)',
    options: ['golpeo', 'agarrón', 'mal_pickup', 'entrada_pé', 'obstrucción', 'protesta', 'bloqueo_ilegal'] 
  },
  'saque_porteria': {
    label: 'Resultado (Opcional)',
    options: ['bo_curto', 'bo_longo', 'malo_curto', 'malo_longo']
  }
};

export default function LogActionModal({ matchId, actionToLog, participants, homeTeamName, awayTeamName, onClose }: LogActionModalProps) {
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [minute, setMinute] = useState<string>('');
  const [second, setSecond] = useState<string>('0');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<ActionType | null>(null);
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtypeConfig = SUBTYPE_OPTIONS[actionToLog.type];
  
  const canHaveCard = actionToLog.type === 'falta_cometida' || actionToLog.type === 'penalti_cometido';

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
      const mainAction: ActionInsert = {
        match_id: matchId,
        team_id: actionToLog.teamId,
        type: actionToLog.type,
        subtype: selectedSubtype || null, 
        minute: parseInt(minute, 10),
        second: second === '' ? 0 : parseInt(second, 10),
        player_id: selectedPlayerId ? parseInt(selectedPlayerId, 10) : null,
        x_position: position?.x ?? null,
        y_position: position?.y ?? null,
      };

      const { error: insertError } = await supabase
        .from('actions')
        .insert(mainAction);

      if (insertError) throw insertError;

      if (selectedCard) {
        const cardAction: ActionInsert = {
          match_id: matchId,
          team_id: actionToLog.teamId,
          type: selectedCard, 
          subtype: null,
          minute: parseInt(minute, 10),
          second: second === '' ? 0 : parseInt(second, 10),
          player_id: selectedPlayerId ? parseInt(selectedPlayerId, 10) : null,
          x_position: position?.x ?? null,
          y_position: position?.y ?? null,
        };

        const { error: cardError } = await supabase
          .from('actions')
          .insert(cardAction);
          
        if (cardError) throw cardError;
      }

      onClose();

    } catch (err: any) {
      console.error("Error ao gardar a acción:", err);
      setError(err.message || 'Erro descoñecido.');
    } finally {
      setLoading(false);
    }
  };

  const formatOption = (opt: string) => {
    const text = opt.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-gray-400 text-sm uppercase tracking-wider">Rexistrar:</span>
          <span className="capitalize text-blue-400">{actionToLog.type.replace(/_/g, ' ')}</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label htmlFor="player_select" className="block text-sm font-medium text-gray-300 mb-1">
              Xogador
            </label>
            <select
              id="player_select"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Acción de equipo / Descoñecido --</option>
              {participants.length === 0 && (
                <option disabled>Non hai xogadores convocados...</option>
              )}
              {participants.map(p => (
                <option key={p.id} value={p.players?.id}>
                  {p.players?.number ? `#${p.players.number} ` : ''}
                  {p.players?.first_name} {p.players?.last_name}
                </option>
              ))}
            </select>
          </div>

          {subtypeConfig && (
            <div className="bg-gray-700/30 p-3 rounded-md border border-gray-600/50">
              <label className="block text-sm font-bold text-blue-300 mb-2">
                {subtypeConfig.label}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {subtypeConfig.options.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedSubtype(prev => prev === opt ? '' : opt)}
                    className={`text-xs sm:text-sm px-2 py-2 rounded border transition-all ${
                      selectedSubtype === opt 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md transform scale-105' 
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {formatOption(opt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canHaveCard && (
            <div className="bg-gray-700/30 p-3 rounded-md border border-gray-600/50 mt-2">
              <label className="block text-sm font-bold text-yellow-200 mb-2">
                Sanción Disciplinaria (Extra)
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCard(prev => prev === 'carton_amarelo' ? null : 'carton_amarelo')}
                  className={`flex-1 py-2 rounded border transition-all font-semibold text-sm ${
                    selectedCard === 'carton_amarelo'
                      ? 'bg-yellow-500 text-black border-yellow-400 scale-105 ring-2 ring-yellow-200'
                      : 'bg-gray-800 text-yellow-500 border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  Amarela
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCard(prev => prev === 'carton_negro' ? null : 'carton_negro')}
                  className={`flex-1 py-2 rounded border transition-all font-semibold text-sm ${
                    selectedCard === 'carton_negro'
                      ? 'bg-black text-white border-gray-500 scale-105 ring-2 ring-gray-400'
                      : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  Negra
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCard(prev => prev === 'carton_vermello' ? null : 'carton_vermello')}
                  className={`flex-1 py-2 rounded border transition-all font-semibold text-sm ${
                    selectedCard === 'carton_vermello'
                      ? 'bg-red-600 text-white border-red-500 scale-105 ring-2 ring-red-300'
                      : 'bg-gray-800 text-red-500 border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  Vermella
                </button>
              </div>
              {selectedCard && (
                <div className="mt-3 p-2 bg-yellow-900/40 border border-yellow-700/50 rounded text-yellow-200 text-xs flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                  <span className="text-lg leading-none">⚠️</span>
                  <p>
                    Ao marcar esta opción, <strong>non necesitas rexistrar a tarxeta de novo</strong> no panel principal.
                  </p>
                </div>
              )}
            </div>
          )}

          {actionToLog.type !== 'saque_porteria' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Posición no campo (Opcional)
              </label>
              <InteractivePitch 
                onPositionSelect={(x, y) => setPosition({ x, y })} 
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minute" className="block text-sm font-medium text-gray-300 mb-1">Minuto*</label>
              <input
                type="number"
                id="minute"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="second" className="block text-sm font-medium text-gray-300 mb-1">Segundo</label>
              <input
                type="number"
                id="second"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="00"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded border border-red-900">{error}</p>}

          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-700 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-transparent text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium shadow-lg shadow-blue-900/50 transition-all active:scale-95"
            >
              {loading ? 'Gardando...' : 'Gardar Acción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}