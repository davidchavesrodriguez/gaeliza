import { useState } from 'react';
import jsPDF from 'jspdf';
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
}

const FEED_GROUPS: Record<string, { label: string, types: string[] }> = {
    remate: { label: 'Remate', types: ['gol', 'punto', 'tiro_fallado'] },
    posesion: { label: 'Posesión', types: ['regate', 'perdida_balon'] },
    defensa: { label: 'Defensa', types: ['balon_ganado', 'recuperacion', 'bloqueo'] },
    infracciones: { label: 'Infraccións', types: ['falta_cometida', 'penalti_cometido', 'carton_amarelo', 'carton_negro', 'carton_vermello'] },
    portero: { label: 'Porteiro', types: ['saque_porteria', 'parada'] }
};

export default function ActionFeed({ actions, homeTeamId, awayTeamId, homeTeamName, awayTeamName, participants, onDeleteAction }: ActionFeedProps) {

    const [isExpanded, setIsExpanded] = useState(false);

    const getPlayerName = (playerId: number | null) => {
        if (!playerId) return 'Acción de Equipo';
        const participant = participants.find(p => p.player_id === playerId);
        if (!participant || !participant.players) return 'Xogador Descoñecido';
        return `${participant.players.number ? '#' + participant.players.number : ''} ${participant.players.first_name} ${participant.players.last_name}`;
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Informe do Partido - Gaeliza', 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`${homeTeamName} vs ${awayTeamName}`, 14, 30);
        doc.text(`Data de Xeración: ${new Date().toLocaleDateString()}`, 14, 36);

        const homeGoals = actions.filter(a => a.team_id === homeTeamId && a.type === 'gol').length;
        const homePoints = actions.filter(a => a.team_id === homeTeamId && a.type === 'punto').length;
        const awayGoals = actions.filter(a => a.team_id === awayTeamId && a.type === 'gol').length;
        const awayPoints = actions.filter(a => a.team_id === awayTeamId && a.type === 'punto').length;

        const homeTotal = (homeGoals * 3) + homePoints;
        const awayTotal = (awayGoals * 3) + awayPoints;

        autoTable(doc, {
            startY: 45,
            head: [['Equipo', 'Goles', 'Puntos', 'Total']],
            body: [
                [homeTeamName, homeGoals, homePoints, homeTotal],
                [awayTeamName, awayGoals, awayPoints, awayTotal],
            ],
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
        });

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
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Tempo', 'Equipo', 'Acción', 'Xogador', 'Detalle']],
            body: tableData,
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [52, 73, 94] },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 40 },
                2: { cellWidth: 35 },
                3: { cellWidth: 50 },
                4: { cellWidth: 'auto' }
            }
        });

        doc.save(`informe_partido_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

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
                            {(action.second ?? 0) > 0 && (
                                <span className="text-xs"> {action.second}''</span>
                            )}

                        </span>

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
                    </div>
                </div>
            </li>
        );
    };

    const renderFullLog = () => {
        const homeActions = actions.filter(a => a.team_id === homeTeamId);
        const awayActions = actions.filter(a => a.team_id === awayTeamId);

        const renderGroupActions = (teamActions: Action[], groupTypes: string[]) => {
            const groupActions = teamActions
                .filter(a => groupTypes.includes(a.type))
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
                                {renderGroupActions(homeActions, group.types)}
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
                                {renderGroupActions(awayActions, group.types)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

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