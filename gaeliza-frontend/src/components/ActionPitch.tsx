import { useState } from 'react';
import type { Database } from '../types/supabase';

type Action = Database['public']['Tables']['actions']['Row'];

interface ActionPitchProps {
  actions: Action[];
  title?: string;
  homeTeamName?: string;
  awayTeamName?: string;
}

/**
 * Configuración visual do mapa: cores e etiquetas para cada tipo de evento.
 */
const MAP_CONFIG: Record<string, { color: string, label: string }> = {
  'gol': { color: '#22c55e', label: 'Gol' },           
  'punto': { color: '#3b82f6', label: 'Punto' },       
  'tiro_fallado': { color: '#ef4444', label: 'Fallo' }, 
  'falta_cometida': { color: '#eab308', label: 'Falta' }, 
  'perdida_balon': { color: '#f97316', label: 'Perda' },  
  'recuperacion': { color: '#06b6d4', label: 'Recup.' },  
  'balon_ganado': { color: '#8b5cf6', label: 'Gañado' }   
};

/**
 * Compoñente ActionPitch
 * Visualiza as accións do partido sobre un mapa vectorial do campo.
 * Permite filtrar os eventos mediante unha lenda interactiva.
 */
export default function ActionPitch({ 
  actions, 
  title = "Mapa de Accións", 
  homeTeamName = "Local", 
  awayTeamName = "Visitante" 
}: ActionPitchProps) {
  
  // Estado inicial dos filtros: mostramos só os tiros para evitar saturación visual
  const [visibleFilters, setVisibleFilters] = useState<string[]>(['gol', 'punto', 'tiro_fallado']);

  /**
   * Alterna a visibilidade dun tipo de acción no mapa.
   */
  const toggleFilter = (type: string) => {
    setVisibleFilters(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Filtramos as accións que teñen coordenadas válidas e cuxo tipo está activo nos filtros
  const filteredActions = actions.filter(a => 
    a.x_position !== null && 
    a.y_position !== null &&
    visibleFilters.includes(a.type)
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
      
      {/* Cabeceira do mapa */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-700">
          {filteredActions.length} eventos
        </span>
      </div>
      
      {/* Representación gráfica do campo (SVG) */}
      <div className="w-full aspect-[145/90] relative bg-green-800 rounded border-2 border-gray-600 overflow-hidden shadow-inner mb-4">
        <svg viewBox="-5 -5 155 100" className="w-full h-full">
          
          {/* Nomes dos equipos sobre o céspede */}
          <text x="8" y="50" fill="rgba(255,255,255,0.1)" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(-90, 8, 50)">
            {homeTeamName.toUpperCase()}
          </text>
          <text x="137" y="50" fill="rgba(255,255,255,0.1)" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(90, 137, 50)">
            {awayTeamName.toUpperCase()}
          </text>

          {/* Fondo e liñas do campo */}
          <rect x="0" y="0" width="145" height="90" fill="#2e7d32" />
          <g stroke="rgba(255, 255, 255, 0.5)" strokeWidth="0.5" fill="none">
             <rect x="0" y="0" width="145" height="90" />
             <line x1="72.5" y1="0" x2="72.5" y2="90" />
             
             {/* Áreas pequena e grande */}
             <rect x="0" y="38.5" width="13" height="13" />
             <rect x="132" y="38.5" width="13" height="13" />
             <rect x="0" y="42.75" width="4.5" height="4.5" />
             <rect x="140.5" y="42.75" width="4.5" height="4.5" />
             
             {/* Liñas descontinuas (13m) */}
             <line x1="13" y1="0" x2="13" y2="90" strokeDasharray="2,2" opacity="0.5" />
             <line x1="132" y1="0" x2="132" y2="90" strokeDasharray="2,2" opacity="0.5" />
             
             {/* Liñas de referencia (20m, 45m, 65m) */}
             <line x1="20" y1="0" x2="20" y2="90" opacity="0.8" />
             <line x1="125" y1="0" x2="125" y2="90" opacity="0.8" />
             <line x1="45" y1="0" x2="45" y2="90" opacity="0.8" />
             <line x1="100" y1="0" x2="100" y2="90" opacity="0.8" />
             
             {/* Porterías */}
             <path d="M0,41.5 L-2,41.5 M0,48.5 L-2,48.5" strokeWidth="1.5" />
             <path d="M145,41.5 L147,41.5 M145,48.5 L147,48.5" strokeWidth="1.5" />
          </g>

          {/* Renderizado dos puntos de acción */}
          {filteredActions.map((action) => {
            const config = MAP_CONFIG[action.type] || { color: '#fff', label: 'Outro' };
            // Convertemos as coordenadas porcentuais (0-100) ás dimensións do viewBox (145x90)
            const cx = (action.x_position ?? 0) * 1.45;
            const cy = (action.y_position ?? 0) * 0.90;

            return (
              <circle
                key={action.id}
                cx={cx} 
                cy={cy} 
                r="1.8"
                fill={config.color}
                stroke="black"
                strokeWidth="0.3"
                className="transition-all hover:r-3 cursor-pointer"
              >
                <title>{`${config.label} (${action.minute}')`}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Lenda interactiva (Filtros) */}
      <div className="flex flex-wrap justify-center gap-2">
        {Object.entries(MAP_CONFIG).map(([type, config]) => {
          const isActive = visibleFilters.includes(type);
          // Só mostramos o botón se existen accións deste tipo no historial do partido
          const hasActions = actions.some(a => a.type === type);
          
          if (!hasActions) return null; 

          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all
                ${isActive 
                  ? 'bg-gray-700 border-gray-500 text-white shadow-sm ring-1 ring-white/10' 
                  : 'bg-gray-800 border-gray-700 text-gray-500 opacity-60 hover:opacity-80'
                }
              `}
            >
              <span 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ backgroundColor: isActive ? config.color : '#6b7280' }}
              ></span>
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}