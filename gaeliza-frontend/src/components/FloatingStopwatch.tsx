interface FloatingStopwatchProps {
  time: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  onAdjust: (seconds: number) => void;
}

// Estilos comúns para os botóns de axuste de tempo
const ADJUST_BTN_CLASS = "px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs sm:text-sm rounded border border-gray-600 transition-colors font-mono";

/**
 * Compoñente de cronómetro flotante.
 * Mantense fixo na parte inferior da pantalla para permitir o control do tempo
 * independentemente do scroll da páxina.
 */
export default function FloatingStopwatch({ time, isRunning, onToggle, onReset, onAdjust }: FloatingStopwatchProps) {
  
  /**
   * Formatea un número total de segundos ao formato estándar "MM:SS".
   * @param totalSeconds - Tempo total en segundos.
   */
  const formatTime = (totalSeconds: number): string => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-700 p-4 shadow-2xl z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        
        {/* Botóns de restar tempo*/}
        <div className="flex gap-2">
          <button onClick={() => onAdjust(-60)} className={ADJUST_BTN_CLASS}>-1m</button>
          <button onClick={() => onAdjust(-10)} className={ADJUST_BTN_CLASS}>-10s</button>
        </div>

        {/* Controles principais */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl sm:text-5xl font-mono font-bold text-white tabular-nums tracking-widest drop-shadow-lg">
            {formatTime(time)}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onToggle}
              className={`px-6 py-1.5 rounded-full text-sm font-bold text-white transition-all shadow-lg uppercase tracking-wide ${
                isRunning 
                  ? 'bg-yellow-600 hover:bg-yellow-500' 
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {isRunning ? 'Pausar' : 'Iniciar'}
            </button>

            <button
              onClick={() => {
                if (window.confirm('Seguro que queres reiniciar o cronómetro a 00:00?')) {
                  onReset();
                }
              }}
              className="text-gray-500 hover:text-red-400 text-xs underline transition-colors"
            >
              Reiniciar
            </button>
          </div>
        </div>

        {/* Botóns de sumar tempo*/}
        <div className="flex gap-2">
          <button onClick={() => onAdjust(10)} className={ADJUST_BTN_CLASS}>+10s</button>
          <button onClick={() => onAdjust(60)} className={ADJUST_BTN_CLASS}>+1m</button>
        </div>

      </div>
    </div>
  );
}