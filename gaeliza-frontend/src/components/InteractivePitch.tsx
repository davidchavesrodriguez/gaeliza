import React, { useState, useRef } from 'react';

interface InteractivePitchProps {
  onPositionSelect: (x: number, y: number) => void;
  initialX?: number | null;
  initialY?: number | null;
  homeTeamName: string;
  awayTeamName: string;
}

export default function InteractivePitch({ onPositionSelect, initialX, initialY, homeTeamName, awayTeamName }: InteractivePitchProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number, y: number } | null>(
    initialX && initialY ? { x: initialX, y: initialY } : null
  );

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSelectedPoint({ x, y });
    onPositionSelect(Math.round(x), Math.round(y));
  };


  const getDynamicFontSize = (text: string) => {
    const length = text.length;
    const baseSize = 14;
    const maxCharsForBaseSize = 12; 

    if (length <= maxCharsForBaseSize) {
      return baseSize;
    }
    
    return Math.max(6, (baseSize * maxCharsForBaseSize) / length);
  };

  return (
    <div className="w-full aspect-[145/90] max-h-[300px] mx-auto relative bg-green-800 rounded border-2 border-gray-600 overflow-hidden shadow-inner">
      <svg
        ref={svgRef}
        onClick={handleClick}
        viewBox="-5 -5 155 100"
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="145" height="90" fill="#2e7d32" />

        <text 
          x="8" 
          y="70" 
          fill="rgba(255,255,255,0.15)" 
          fontSize={getDynamicFontSize(homeTeamName)} 
          fontWeight="bold" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          transform="rotate(-90, 8, 45)" 
          style={{ pointerEvents: 'none' }}
        >
          {homeTeamName.toUpperCase()}
        </text>

        <text 
          x="137" 
          y="70" 
          fill="rgba(255,255,255,0.15)"
          fontSize={getDynamicFontSize(awayTeamName)} 
          fontWeight="bold" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          transform="rotate(90, 137, 45)" 
          style={{ pointerEvents: 'none' }}
        >
          {awayTeamName.toUpperCase()}
        </text>

        <g stroke="rgba(255, 255, 255, 0.6)" strokeWidth="0.5" fill="none">
          <rect x="0" y="0" width="145" height="90" />
          
          <line x1="72.5" y1="0" x2="72.5" y2="90" />
          <text x="72.5" y="94" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">65m</text>

          <rect x="0" y="42.75" width="4.5" height="4.5" />
          <rect x="0" y="38.5" width="13" height="13" />
          
          <line x1="13" y1="0" x2="13" y2="90" strokeDasharray="2,2" opacity="0.7" />
          <text x="13" y="3" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">13m</text>
          
          <line x1="20" y1="0" x2="20" y2="90" />
          <text x="20" y="94" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">20m</text>
          
          <line x1="45" y1="0" x2="45" y2="90" />
          <text x="45" y="3" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">45m</text>

          <rect x="140.5" y="42.75" width="4.5" height="4.5" />
          <rect x="132" y="38.5" width="13" height="13" />
          
          <line x1="132" y1="0" x2="132" y2="90" strokeDasharray="2,2" opacity="0.7" />
          <text x="132" y="3" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">13m</text>
          
          <line x1="125" y1="0" x2="125" y2="90" />
          <text x="125" y="94" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">20m</text>
          
          <line x1="100" y1="0" x2="100" y2="90" />
          <text x="100" y="3" fill="rgba(255,255,255,0.6)" fontSize="3" textAnchor="middle">45m</text>

          <path d="M0,41.5 L-2,41.5 M0,48.5 L-2,48.5" strokeWidth="1" />
          <path d="M145,41.5 L147,41.5 M145,48.5 L147,48.5" strokeWidth="1" />
        </g>

        {selectedPoint && (
          <circle 
            cx={selectedPoint.x * 1.45}
            cy={selectedPoint.y * 0.90}
            r="2" 
            fill="#FFFF00" 
            stroke="black" 
            strokeWidth="0.5"
          />
        )}
      </svg>
      
      {!selectedPoint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
            Toca para marcar posición
          </span>
        </div>
      )}
    </div>
  );
}