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

/**
 * Compoñente modal para engadir xogadores a unha convocatoria.
 * Permite seleccionar xogadores existentes do club (ou filiais)
 * ou crear novos xogadores "temporais".
 */
export default function AddPlayerModal({ matchId, team, onClose, existingParticipantIds }: AddPlayerModalProps) {

  // Estado para controlar o modo de operación: selección ou creación
  const [mode, setMode] = useState<'select' | 'create'>('select');
  
  // Estados de datos
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  // Estado para o formulario de novo xogador
  const [newPlayerData, setNewPlayerData] = useState({
    first_name: '',
    last_name: '',
    number: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial de xogadores dispoñibles (equipo principal + filiais)
  useEffect(() => {
    const loadPlayers = async () => {
      setLoadingPlayers(true);
      setError(null);
      try {
        // 1. Buscar IDs de equipos filiais
        const { data: filialTeams } = await supabase
          .from('teams')
          .select('id')
          .eq('parent_team_id', team.id);

        const filialIds = filialTeams ? filialTeams.map(t => t.id) : [];
        const allTeamIds = [team.id, ...filialIds];

        // 2. Cargar xogadores de todos os equipos relacionados
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .in('team_id', allTeamIds) 
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

  /**
   * Xestiona o envío do formulario.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let playerToAddId: number;

      // CASO 1: Crear novo xogador temporal
      if (mode === 'create') {
        if (!newPlayerData.first_name.trim()) {
          throw new Error('O nome é obrigatorio');
        }

        const { data: newPlayer, error: createPlayerError } = await supabase
          .from('players')
          .insert({
            first_name: newPlayerData.first_name.trim(),
            last_name: newPlayerData.last_name.trim(),
            number: newPlayerData.number === '' ? null : parseInt(newPlayerData.number, 10),
            team_id: team.id,
            type: 'temporal'
          })
          .select('id')
          .single();

        if (createPlayerError) throw createPlayerError;
        if (!newPlayer) throw new Error('Non se puido crear o xogador');

        playerToAddId = newPlayer.id;

      // CASO 2: Seleccionar xogador existente
      } else {
        if (!selectedPlayerId) {
          throw new Error('Debes seleccionar un xogador.');
        }
        playerToAddId = parseInt(selectedPlayerId, 10);
      }

      // Engadir á táboa de participantes do partido
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

  // Filtrar xogadores que xa están convocados para non mostralos no select
  const availablePlayers = players.filter(p => !existingParticipantIds.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        
        <h2 className="text-xl font-bold text-white mb-4">
          Engadir Xogador a <span className="text-blue-400">{team.name}</span>
        </h2>

        {/* Pestañas de modo */}
        <div className="flex mb-4 border-b border-gray-700">
          <button
            onClick={() => setMode('select')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'select' 
                ? 'border-b-2 border-blue-500 text-white' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Seleccionar Existente
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'create' 
                ? 'border-b-2 border-blue-500 text-white' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Crear Novo (Temporal)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* MODO SELECCIÓN */}
          {mode === 'select' && (
            <div className="space-y-4">
              <label htmlFor="player_select" className="block text-sm font-medium text-gray-300">
                Xogadores dispoñibles (Club)
              </label>
              <select
                id="player_select"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                required
                disabled={loadingPlayers}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>{loadingPlayers ? 'Cargando...' : 'Selecciona...'}</option>

                {availablePlayers.length === 0 && !loadingPlayers && (
                  <option disabled>Non hai máis xogadores dispoñibles</option>
                )}

                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} {p.number ? `(#${p.number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MODO CREACIÓN */}
          {mode === 'create' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs text-gray-400 bg-gray-900/50 p-2 rounded">
                ℹ️ O xogador crearase como 'temporal' e vincularase a este equipo só para este partido.
              </p>
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-300">Nome *</label>
                <input 
                  type="text" 
                  name="first_name" 
                  id="first_name" 
                  value={newPlayerData.first_name} 
                  onChange={handleNewPlayerFormChange} 
                  required 
                  className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-300">Apelidos</label>
                <input 
                  type="text" 
                  name="last_name" 
                  id="last_name" 
                  value={newPlayerData.last_name} 
                  onChange={handleNewPlayerFormChange} 
                  className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label htmlFor="number" className="block text-sm font-medium text-gray-300">Dorsal</label>
                <input 
                  type="number" 
                  name="number" 
                  id="number" 
                  value={newPlayerData.number} 
                  onChange={handleNewPlayerFormChange} 
                  className="w-full mt-1 px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>
          )}

          {/* Mensaxes de erro */}
          {error && (
            <div className="p-2 bg-red-900/30 border border-red-800 rounded">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Botóns de acción */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700 mt-4">
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
              disabled={loading || (mode === 'select' && !selectedPlayerId)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Gardando...' : 'Engadir Xogador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}