import { useState, type FormEvent } from 'react';
import { supabase } from '../supabaseClient'; 
import type { Database } from '../types/supabase'; 

type MatchInsert = Database['public']['Tables']['matches']['Insert'];

interface MatchFormProps {
  onMatchCreated: () => void; 
  onCancel: () => void;
}

export default function MatchForm({ onMatchCreated, onCancel }: MatchFormProps) {

  const [formData, setFormData] = useState<Partial<MatchInsert>>({
    home_team_id: undefined,
    away_team_id: undefined,
    match_date: new Date().toISOString().slice(0, 16), 
    location: '',
    competition: '',
    video_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'number' ? (value === '' ? undefined : parseInt(value, 10)) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.home_team_id || !formData.away_team_id || !formData.match_date) {
      setError('Los equipos y la fecha son obligatorios.');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const matchToInsert: MatchInsert = {
        home_team_id: formData.home_team_id,
        away_team_id: formData.away_team_id,
        match_date: formData.match_date, 
        location: formData.location || null, 
        competition: formData.competition || null,
        video_url: formData.video_url || null,
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchToInsert);

      if (insertError) throw insertError;

      alert('¡Partido registrado con éxito!');
      onMatchCreated();

    } catch (err: any) {
      setError(err.message || 'Error al registrar el partido.');
      console.error("Error inserting match:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20 p-4">
      <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Rexistrar novo partido</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="home_team_id" className="block text-sm font-medium text-gray-300 mb-1">
                Equipo Local (ID)*
              </label>
              <input
                type="number"
                id="home_team_id"
                name="home_team_id"
                value={formData.home_team_id ?? ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="ID numérico"
              />
              {/* TODO: Reemplazar input numérico con un <select> cargado desde la tabla 'teams' */}
            </div>
            <div>
              <label htmlFor="away_team_id" className="block text-sm font-medium text-gray-300 mb-1">
                Equipo Visitante (ID)*
              </label>
              <input
                type="number"
                id="away_team_id"
                name="away_team_id"
                value={formData.away_team_id ?? ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="ID numérico"
              />
              {/* TODO: Reemplazar input numérico con un <select> cargado desde la tabla 'teams' */}
            </div>
          </div>

          <div>
            <label htmlFor="match_date" className="block text-sm font-medium text-gray-300 mb-1">
              Fecha y Hora*
            </label>
            <input
              type="datetime-local"
              id="match_date"
              name="match_date"
              value={formData.match_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-1">
                Lugar (Opcional)
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location ?? ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Ej: Estadio As Cancelas"
              />
            </div>
            <div>
              <label htmlFor="competition" className="block text-sm font-medium text-gray-300 mb-1">
                Competición (Opcional)
              </label>
              <input
                type="text"
                id="competition"
                name="competition"
                value={formData.competition ?? ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Ej: Liga Galega"
              />
            </div>
          </div>

          <div>
            <label htmlFor="video_url" className="block text-sm font-medium text-gray-300 mb-1">
              URL de Youtube (Opcional)
            </label>
            <input
              type="url" 
              id="video_url"
              name="video_url"
              value={formData.video_url ?? ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-900 bg-opacity-50 p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button" 
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 transition-colors flex items-center"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Gardando...' : 'Rexistrar Partido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
