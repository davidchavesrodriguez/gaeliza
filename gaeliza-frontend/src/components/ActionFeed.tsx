import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Database } from '../types/supabase';

type Action = Database['public']['Tables']['actions']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Participant = Database['public']['Tables']['match_participants']['Row'];
type ParticipantWithPlayer = Participant & {
  players: Pick<Player, 'id' | 'first_name' | 'last_name' | 'number'> | null
};

interface ActionFeedProps {
  actions: Action[];
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  participants: ParticipantWithPlayer[];
  onDeleteAction: (id: number) => void;
  readOnly?: boolean;
}

/**
 * Configuración das categorías para agrupar as accións no log completo.
 */
const FEED_GROUPS: Record<string, { label: string, types: string[] }> = {
  remate: { label: 'Remate', types: ['gol', 'punto', 'tiro_fallado'] },
  posesion: { label: 'Posesión', types: ['regate', 'perdida_balon'] },
  defensa: { label: 'Defensa', types: ['balon_ganado', 'recuperacion', 'bloqueo'] },
  infracciones: { label: 'Infraccións', types: ['falta_cometida', 'penalti_cometido', 'carton_amarelo', 'carton_negro', 'carton_vermello'] },
  portero: { label: 'Porteiro', types: ['saque_porteria', 'parada'] }
};

/**
 * Compoñente ActionFeed
 * Mostra o historial de accións do partido, permite o seu borrado e a exportación a PDF.
 * Ten dous modos de visualización: resumo (últimas accións) e expandido (agrupado por categorías).
 */
export default function ActionFeed({ 
  actions, 
  homeTeamId, 
  awayTeamId, 
  homeTeamName, 
  awayTeamName, 
  participants, 
  onDeleteAction, 
  readOnly = false 
}: ActionFeedProps) {
  
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Obtén o nome formatado dun xogador (Dorsal + Nome + Apelido).
   * @param playerId - ID do xogador na táboa players.
   * @returns Cadea de texto co nome ou un valor por defecto.
   */
  const getPlayerName = (playerId: number | null): string => {
    if (!playerId) return 'Acción de Equipo';
    
    const player = participants.find(p => p.player_id === playerId)?.players;
    if (!player) return 'Xogador Descoñecido';

    return `${player.number ? '#' + player.number : ''} ${player.first_name} ${player.last_name}`;
  };

  /**
   * Xera e descarga un informe PDF completo do partido.
   * Inclúe cabeceira, marcador, mapas de tiro vectoriais e táboa de eventos.
   */
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabeceira do documento
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Informe do Partido', 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text('Gaeliza Analytics', 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Xerado o: ${new Date().toLocaleDateString()} ás ${new Date().toLocaleTimeString()}`, pageWidth - 14, 28, { align: 'right' });

    // 2. Cálculo do marcador
    const countAction = (teamId: number, type: string) => actions.filter(a => a.team_id === teamId && a.type === type).length;
    
    const homeGoals = countAction(homeTeamId, 'gol');
    const homePoints = countAction(homeTeamId, 'punto');
    const awayGoals = countAction(awayTeamId, 'gol');
    const awayPoints = countAction(awayTeamId, 'punto');

    const homeTotal = (homeGoals * 3) + homePoints;
    const awayTotal = (awayGoals * 3) + awayPoints;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`${homeTeamName} vs ${awayTeamName}`, 14, 55);

    autoTable(doc, {
      startY: 60,
      head: [['Equipo', 'Goles', 'Puntos', 'TOTAL']],
      body: [
        [homeTeamName, homeGoals, homePoints, homeTotal],
        [awayTeamName, awayGoals, awayPoints, awayTotal],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { halign: 'center', fontSize: 12 },
    });

    // 3. Función para debuxar o campo vectorial e os eventos
    const drawPitch = (startX: number, startY: number, title: string, teamId: number) => {
      const w = 80;
      const h = 50;

      // Título do mapa
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(title, startX + (w/2), startY - 2, { align: 'center' });

      // Fondo do campo
      doc.setFillColor(34, 197, 94);
      doc.setDrawColor(255, 255, 255);
      doc.rect(startX, startY, w, h, 'F');
      doc.rect(startX, startY, w, h, 'S');

      // Liñas do campo
      doc.setLineWidth(0.5);
      doc.line(startX + (w/2), startY, startX + (w/2), startY + h);
      doc.line(startX + 10, startY, startX + 10, startY + h);
      doc.line(startX + w - 10, startY, startX + w - 10, startY + h);

      // Porterías
      doc.setLineWidth(1);
      doc.line(startX, startY + (h/2) - 3, startX, startY + (h/2) + 3);
      doc.line(startX + w, startY + (h/2) - 3, startX + w, startY + (h/2) + 3);

      const teamActions = actions.filter(a => a.team_id === teamId && a.x_position && a.y_position);
      
      teamActions.forEach(action => {
        const px = startX + (action.x_position! * w / 100);
        const py = startY + (action.y_position! * h / 100);

        if (action.type === 'gol') doc.setFillColor(0, 200, 0);
        else if (action.type === 'punto') doc.setFillColor(0, 0, 255);
        else if (action.type === 'tiro_fallado') doc.setFillColor(255, 0, 0);
        else return;

        doc.circle(px, py, 1.5, 'F');
        doc.setDrawColor(0,0,0);
        doc.circle(px, py, 1.5, 'S');
      });
    };

    const pitchY = (doc as any).lastAutoTable.finalY + 15;
    
    drawPitch(14, pitchY, `Mapa de Tiro: ${homeTeamName}`, homeTeamId);
    drawPitch(110, pitchY, `Mapa de Tiro: ${awayTeamName}`, awayTeamId);

    // 4. Lenda dos mapas
    const legendY = pitchY + 55;
    const centerX = pageWidth / 2;
    
    doc.setFontSize(9);
    doc.setTextColor(50);

    doc.setFillColor(0, 200, 0);
    doc.circle(centerX - 30, legendY, 2, 'F');
    doc.text('Gol', centerX - 25, legendY + 1);

    doc.setFillColor(0, 0, 255);
    doc.circle(centerX - 5, legendY, 2, 'F');
    doc.text('Punto', centerX, legendY + 1);

    doc.setFillColor(255, 0, 0);
    doc.circle(centerX + 20, legendY, 2, 'F');
    doc.text('Fallo', centerX + 25, legendY + 1);

    // 5. Táboa detallada de eventos
    const sortedActions = [...actions].sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      return (a.second || 0) - (b.second || 0);
    });

    const tableData = sortedActions.map(action => {
      const isHome = action.team_id === homeTeamId;
      const team = isHome ? homeTeamName : awayTeamName;
      const player = getPlayerName(action.player_id);
      const type = action.type.replace(/_/g, ' ').toUpperCase();
      const detail = action.subtype ? action.subtype.replace(/_/g, ' ') : '-';
      const time = `${action.minute}' ${action.second}''`;
      return [time, team, type, player, detail];
    });

    autoTable(doc, {
      startY: pitchY + 65,
      head: [['Tempo', 'Equipo', 'Acción', 'Xogador', 'Detalle']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [55, 65, 81] },
      columnStyles: {
        0: { cellWidth: 20 }, 
        1: { cellWidth: 40 },
        4: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const isHome = data.cell.raw === homeTeamName;
          data.cell.styles.textColor = isHome ? [37, 99, 235] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`informe_gaeliza_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  /**
   * Compoñente interno para renderizar unha tarxeta de acción individual.
   */
  const ActionCard = ({ action, simple = false }: { action: Action, simple?: boolean }) => {
    const isHome = action.team_id === homeTeamId;
    const teamName = isHome ? homeTeamName : awayTeamName;
    const borderColor = isHome ? 'border-l-blue-500' : 'border-l-red-500';

    return (
      <li className={`text-xs text-gray-300 bg-gray-800/50 p-3 rounded-r border-l-4 ${borderColor} mb-2 group`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="font-bold text-white capitalize text-sm">
              {action.type.replace(/_/g, ' ')}
            </span>
            {simple && <span className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{teamName}</span>}
            <span className="text-gray-400 mt-1">
              {getPlayerName(action.player_id)}
            </span>
            {action.subtype && (
              <span className="text-gray-500 italic mt-0.5">
                ({action.subtype.replace(/_/g, ' ')})
              </span>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className="font-mono text-lg font-bold text-gray-500">
              {action.minute}'
              {action.second !== null && action.second > 0 && <span className="text-xs"> {action.second}''</span>}
            </span>
            
            {!readOnly && (
              <button
                onClick={() => {
                  if (window.confirm('Seguro que queres borrar esta acción?')) {
                    onDeleteAction(action.id);
                  }
                }}
                className="text-gray-600 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Borrar acción"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  /**
   * Renderiza a vista completa do log, agrupada por equipos e categorías.
   */
  const renderFullLog = () => {
    const renderGroupActions = (teamId: number, groupTypes: string[]) => {
      const groupActions = actions
        .filter(a => a.team_id === teamId && groupTypes.includes(a.type))
        .sort((a, b) => {
          if (a.minute !== b.minute) return a.minute - b.minute;
          return (a.second || 0) - (b.second || 0);
        });

      if (groupActions.length === 0) return <p className="text-xs text-gray-600 italic px-2 mb-2">Sen accións.</p>;

      return (
        <ul className="mb-4">
          {groupActions.map(action => <ActionCard key={action.id} action={action} />)}
        </ul>
      );
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-center font-bold text-white border-b border-gray-700 pb-2 mb-4 sticky top-0 bg-gray-900 z-10">{homeTeamName}</h4>
          <div className="space-y-2">
            {Object.entries(FEED_GROUPS).map(([key, group]) => (
              <div key={key}>
                <h5 className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider bg-gray-800/30 p-1 rounded">{group.label}</h5>
                {renderGroupActions(homeTeamId, group.types)}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-center font-bold text-white border-b border-gray-700 pb-2 mb-4 sticky top-0 bg-gray-900 z-10">{awayTeamName}</h4>
          <div className="space-y-2">
            {Object.entries(FEED_GROUPS).map(([key, group]) => (
              <div key={key}>
                <h5 className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider bg-gray-800/30 p-1 rounded">{group.label}</h5>
                {renderGroupActions(awayTeamId, group.types)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renderiza a vista resumida (as 3 últimas accións cronolóxicas).
   */
  const renderRecentSummary = () => {
    const recentActions = [...actions].sort((a, b) => {
      if (a.minute !== b.minute) return b.minute - a.minute;
      return (b.second || 0) - (a.second || 0);
    }).slice(0, 3);

    if (recentActions.length === 0) return <p className="text-center text-gray-500 py-4">Aínda non hai accións rexistradas.</p>;

    return (
      <ul className="space-y-2 max-w-xl mx-auto">
        {recentActions.map(action => (
          <ActionCard key={action.id} action={action} simple={true} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mt-8 border-t border-gray-700 pt-6">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-lg font-semibold text-white">
          {isExpanded ? 'Log Completo do Partido' : 'Últimas Accións'}
        </h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
        >
          {isExpanded ? 'Ver menos' : 'Ver rexistro completo'} 
          <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
        </button>
      </div>
      
      {isExpanded ? renderFullLog() : renderRecentSummary()}

      <div className="mt-6 flex justify-center border-t border-gray-700 pt-6">
        <button
          onClick={generatePDF}
          className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full border border-gray-600 transition-all shadow-lg hover:shadow-blue-900/20"
        >
          <span className="text-lg">📄</span>
          <span className="font-medium">Descargar Informe PDF</span>
        </button>
      </div>

    </div>
  );
}