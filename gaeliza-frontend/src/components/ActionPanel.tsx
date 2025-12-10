import { useState, useEffect } from 'react';

// Definición de todos os tipos de acción posibles no sistema
export type ActionType = 
  | 'gol' 
  | 'punto' 
  | 'tiro_fallado'
  | 'perdida_balon' 
  | 'regate'
  | 'balon_ganado'
  | 'recuperacion'
  | 'bloqueo'
  | 'falta_cometida'
  | 'penalti_cometido'
  | 'carton_amarelo' 
  | 'carton_negro' 
  | 'carton_vermello'
  | 'parada'
  | 'saque_porteria';

/**
 * Etiquetas de texto para mostrar na interface de configuración.
 */
const LABELS: Record<string, string> = {
  gol: 'Gol',
  punto: 'Punto',
  tiro_fallado: 'Tiro Fallado',
  regate: 'Regate',
  perdida_balon: 'Perda de Balón',
  balon_ganado: 'Balón Dividido Gañado',
  recuperacion: 'Recuperación',
  bloqueo: 'Bloqueo',
  falta_cometida: 'Falta',
  penalti_cometido: 'Penalti',
  carton_amarelo: 'Cartóns',
  saque_porteria: 'Saque de Portería',
  parada: 'Parada'
};

/**
 * Estrutura de configuración para os grupos de botóns.
 */
const ACTION_GROUPS = [
  {
    id: 'remate',
    title: 'Remate',
    actions: [
      { key: 'gol', label: 'Gol', className: 'bg-green-600 hover:bg-green-500 text-white' },
      { key: 'punto', label: 'Punto', className: 'bg-green-700 hover:bg-green-600 text-white' },
      { key: 'tiro_fallado', label: 'Fallo', className: 'bg-red-600 hover:bg-red-500 text-gray-200' }
    ]
  },
  {
    id: 'posesion',
    title: 'Posesión',
    actions: [
      { key: 'regate', label: 'Regate', className: 'bg-teal-700 hover:bg-teal-600 text-white' },
      { key: 'perdida_balon', label: 'Perda Balón', className: 'bg-red-800 hover:bg-red-700 text-white' }
    ]
  },
  {
    id: 'defensa',
    title: 'Defensa',
    actions: [
      { key: 'balon_ganado', label: 'Balón Dividido Gañado', className: 'bg-blue-600 hover:bg-blue-500 text-white' },
      { key: 'recuperacion', label: 'Recuperación', className: 'bg-blue-700 hover:bg-blue-600 text-white' },
      { key: 'bloqueo', label: 'Bloqueo', className: 'bg-blue-800 hover:bg-blue-700 text-white' }
    ]
  },
  {
    id: 'porteiro',
    title: 'Porteiro',
    actions: [
      { key: 'saque_porteria', label: 'Saque', className: 'bg-gray-700 hover:bg-gray-600 text-gray-300' },
      { key: 'parada', label: 'Parada', className: 'bg-indigo-600 hover:bg-indigo-500 text-white' }
    ]
  }
];

interface ActionPanelProps {
  onLogAction: (action: ActionType, teamId: number) => void;
  homeTeamId: number;
  awayTeamId: number;
}

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  spanFull?: boolean;
}

/**
 * Compoñente para os botóns de acción.
 */
const ActionButton = ({ onClick, children, className = '', spanFull = false }: ActionButtonProps) => (
  <button 
    onClick={onClick} 
    className={`w-full py-1.5 px-1 rounded text-xs sm:text-sm font-medium transition-colors truncate ${className} ${spanFull ? 'col-span-2' : ''}`}
  >
    {children}
  </button>
);

interface TeamColumnProps {
  teamName: string;
  teamId: number;
  onLog: (action: ActionType, teamId: number) => void;
  visibleActions: string[];
}

/**
 * Columna que renderiza todos os botóns para un equipo específico.
 */
const TeamColumn = ({ teamName, teamId, onLog, visibleActions }: TeamColumnProps) => {
  
  const isVisible = (key: string) => visibleActions.includes(key);

  return (
    <div className="flex flex-col gap-4 bg-gray-900/50 p-3 rounded-lg">
      <h4 className="text-center font-bold text-white border-b border-gray-700 pb-2">{teamName}</h4>
      
      {/* 1. Gruposxerados dende a configuración */}
      {ACTION_GROUPS.map(group => {
        const groupActiveActions = group.actions.filter(a => isVisible(a.key));
        
        if (groupActiveActions.length === 0) return null;

        return (
          <div key={group.id}>
            <h5 className="text-xs text-gray-400 uppercase mb-1 font-semibold">{group.title}</h5>
            <div className="grid grid-cols-2 gap-2">
              {groupActiveActions.map((action, index) => {
                // Cálculo para que o último botón ocupe todo o ancho se o número total é impar
                const isLast = index === groupActiveActions.length - 1;
                const isOddTotal = groupActiveActions.length % 2 !== 0;
                
                return (
                  <ActionButton 
                    key={action.key} 
                    onClick={() => onLog(action.key as ActionType, teamId)} 
                    className={action.className}
                    spanFull={isLast && isOddTotal}
                  >
                    {action.label}
                  </ActionButton>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 2. Grupo de Infraccións*/}
      {(isVisible('falta_cometida') || isVisible('penalti_cometido') || isVisible('carton_amarelo')) && (
        <div>
          <h5 className="text-xs text-gray-400 uppercase mb-1 font-semibold">Infraccións</h5>
          <div className="grid grid-cols-2 gap-2">
            {isVisible('falta_cometida') && (
              <ActionButton 
                onClick={() => onLog('falta_cometida', teamId)} 
                className="bg-yellow-700 hover:bg-yellow-600 text-white" 
                spanFull={!isVisible('penalti_cometido') && !isVisible('carton_amarelo')}
              >
                Falta
              </ActionButton>
            )}
            
            {isVisible('penalti_cometido') && (
              <ActionButton 
                onClick={() => onLog('penalti_cometido', teamId)} 
                className="bg-red-600 hover:bg-red-500 text-white" 
                spanFull={!isVisible('falta_cometida') && !isVisible('carton_amarelo')}
              >
                Penalti
              </ActionButton>
            )}
            
            {/* Sub-botóns de cartóns */}
            {isVisible('carton_amarelo') && (
              <div className="col-span-2 flex gap-1">
                  <button onClick={() => onLog('carton_amarelo', teamId)} className="flex-1 h-6 bg-yellow-400 hover:bg-yellow-300 rounded text-black text-xs font-bold">Amarelo</button>
                  <button onClick={() => onLog('carton_negro', teamId)} className="flex-1 h-6 bg-gray-900 border border-gray-600 hover:bg-black rounded text-white text-xs font-bold">Negro</button>
                  <button onClick={() => onLog('carton_vermello', teamId)} className="flex-1 h-6 bg-red-600 hover:bg-red-500 rounded text-white text-xs font-bold">Vermello</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Panel de Control Principal.
 * Xestiona a visibilidade dos botóns e presenta as columnas de acción para ambos equipos.
 */
export default function ActionPanel({ onLogAction, homeTeamId, awayTeamId }: ActionPanelProps) {
  // Estado persistente para lembrar a configuración do usuario
  const [visibleActions, setVisibleActions] = useState<string[]>(() => {
    const saved = localStorage.getItem('gaeliza_visible_actions');
    return saved ? JSON.parse(saved) : Object.keys(LABELS);
  });
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('gaeliza_visible_actions', JSON.stringify(visibleActions));
  }, [visibleActions]);

  const toggleAction = (actionKey: string) => {
    setVisibleActions(prev => 
      prev.includes(actionKey) 
        ? prev.filter(k => k !== actionKey) 
        : [...prev, actionKey] 
    );
  };

  return (
    <div className="border-t border-gray-700 mt-6 pt-4 relative">
      <div className="flex justify-between items-center mb-3 relative z-30">
        <h3 className="text-lg font-semibold text-white">Rexistro de Accións</h3>
        
        {/* Menú de Configuración */}
        <div className="relative">
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-gray-600"
            title="Personalizar botóns visibles"
          >
            <span>⚙️</span>
            <span>Configurar Panel</span>
          </button>

          {isConfigOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 z-50">
              <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
                <h4 className="text-sm font-bold text-white">Personalizar Panel</h4>
                <button onClick={() => setIsConfigOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              
              <p className="text-xs text-gray-400 mb-3 bg-gray-900/50 p-2 rounded">
                Desmarca as accións que non uses para simplificar a túa pantalla.
              </p>
              
              <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto pr-1">
                {Object.entries(LABELS).map(([key, label]) => (
                  <label key={key} className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors ${visibleActions.includes(key) ? 'bg-blue-900/30 text-white' : 'text-gray-400 hover:bg-gray-700/30'}`}>
                    <input 
                      type="checkbox" 
                      checked={visibleActions.includes(key)}
                      onChange={() => toggleAction(key)}
                      className="rounded border-gray-500 bg-gray-700 text-blue-500 w-4 h-4 focus:ring-offset-0 focus:ring-1"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grelha de accións */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <TeamColumn 
          teamName="LOCAL" 
          teamId={homeTeamId} 
          onLog={onLogAction} 
          visibleActions={visibleActions} 
        />
        <TeamColumn 
          teamName="VISITANTE" 
          teamId={awayTeamId} 
          onLog={onLogAction} 
          visibleActions={visibleActions} 
        />
      </div>
    </div>
  );
}