import React from 'react';

export type ActionType = 'gol' | 'punto' | 'cartón_amarelo' | 'cartón_vermello' | 'cartón_negro' | 'falta';

interface ActionPanelProps {
  onLogAction: (action: ActionType, teamId: number) => void;
  homeTeamId: number;
  awayTeamId: number;
}

const ActionButton = ({ onClick, children, className }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full p-2 rounded-md text-sm font-medium transition-colors ${className}`}
  >
    {children}
  </button>
);

export default function ActionPanel({ onLogAction, homeTeamId, awayTeamId }: ActionPanelProps) {
  return (
    <div className="border-t border-gray-700 mt-6 pt-4">
      <h3 className="text-lg font-semibold text-white mb-3">Rexistro de Accións</h3>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">

        <div className="space-y-2">
          <ActionButton 
            onClick={() => onLogAction('gol', homeTeamId)}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            GOL (Local)
          </ActionButton>
          <ActionButton 
            onClick={() => onLogAction('punto', homeTeamId)}
            className="bg-green-800 hover:bg-green-700 text-white"
          >
            Punto (Local)
          </ActionButton>
        </div>

        <div className="space-y-2">
          <ActionButton 
            onClick={() => onLogAction('gol', awayTeamId)}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            GOL (Visitante)
          </ActionButton>
          <ActionButton 
            onClick={() => onLogAction('punto', awayTeamId)}
            className="bg-green-800 hover:bg-green-700 text-white"
          >
            Punto (Visitante)
          </ActionButton>
        </div>

      </div>

      <p className="text-gray-400 text-sm mt-4">
        (Próximamente: campo interactivo para marcar posicións)
      </p>
    </div>
  );
}