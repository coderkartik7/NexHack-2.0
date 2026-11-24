import React from 'react';
import type { DropZoneTarget } from '../lesson/lessonData';
import { DropZone } from './DropZone';

interface DiagramPanelProps {
  zones: DropZoneTarget[];
  placements: Record<string, string | null>;
  placementResults: Record<string, boolean>;
  hoveredTargetId?: string | null;
  snapZoneId?: string | null;
}

export const DiagramPanel: React.FC<DiagramPanelProps> = ({
  zones,
  placements,
  placementResults,
  hoveredTargetId,
  snapZoneId,
}) => {
  return (
    <div className="relative w-full aspect-16/10 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-sm flex items-center justify-center p-2">
      {/* Inline SVG Plant Cell Diagram */}
      <svg
        viewBox="0 0 800 500"
        className="w-full h-full object-contain pointer-events-none select-none opacity-90"
      >
        <defs>
          <radialGradient id="cellWallGrad" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#064e3b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="nucleusGrad" cx="45%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0.9" />
          </radialGradient>
          <radialGradient id="chloroplastGrad" cx="40%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#065f46" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Outer Plant Cell Wall (Poly-like rounded hexagon) */}
        <polygon
          points="80,100 240,40 560,40 720,120 740,360 620,460 220,460 60,340"
          fill="url(#cellWallGrad)"
          stroke="#10b981"
          strokeWidth="12"
          strokeLinejoin="round"
        />

        {/* Plasma Membrane */}
        <polygon
          points="90,110 245,55 550,55 705,130 725,350 610,445 230,445 75,330"
          fill="#064e3b"
          fillOpacity="0.3"
          stroke="#34d399"
          strokeWidth="3"
          strokeDasharray="6 4"
        />

        {/* Central Large Vacuole */}
        <path
          d="M 320,140 C 440,110 580,160 560,280 C 540,380 380,410 320,360 C 260,310 240,170 320,140 Z"
          fill="#0284c7"
          fillOpacity="0.2"
          stroke="#38bdf8"
          strokeWidth="3"
        />
        <text x="400" y="270" fill="#7dd3fc" fontSize="13" fontFamily="monospace" textAnchor="middle" opacity="0.8">
          Central Vacuole
        </text>

        {/* Nucleus (center-left) */}
        <circle cx="368" cy="220" r="54" fill="url(#nucleusGrad)" stroke="#818cf8" strokeWidth="4" />
        <circle cx="368" cy="220" r="20" fill="#1e1b4b" opacity="0.8" />

        {/* Chloroplast Organelles (several distributed green discs) */}
        <g transform="translate(192, 310)">
          <ellipse cx="0" cy="0" rx="42" ry="26" fill="url(#chloroplastGrad)" stroke="#34d399" strokeWidth="3" transform="rotate(-25)" />
          {/* Thylakoid grana lines */}
          <line x1="-20" y1="-5" x2="20" y2="-5" stroke="#a7f3d0" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="-24" y1="4" x2="24" y2="4" stroke="#a7f3d0" strokeWidth="2" strokeDasharray="3 3" />
        </g>

        <g transform="translate(580, 110)">
          <ellipse cx="0" cy="0" rx="36" ry="22" fill="url(#chloroplastGrad)" stroke="#34d399" strokeWidth="2.5" transform="rotate(35)" />
        </g>

        <g transform="translate(630, 360)">
          <ellipse cx="0" cy="0" rx="38" ry="24" fill="url(#chloroplastGrad)" stroke="#34d399" strokeWidth="2.5" transform="rotate(-15)" />
        </g>
      </svg>

      {/* Interactive Drop Zones rendered absolutely over diagram */}
      {zones.map((zone) => {
        // Find which label is placed in this zone
        const placedLabelId = Object.keys(placements).find((k) => placements[k] === zone.id);
        const isCorrect = placedLabelId ? placementResults[placedLabelId] : false;
        const labelText = placedLabelId ? zone.name : null;

        return (
          <DropZone
            key={zone.id}
            zone={zone}
            placedLabelText={labelText}
            isCorrect={isCorrect}
            isHovered={hoveredTargetId === `target_${zone.id}`}
            isSnapTarget={snapZoneId === zone.id}
          />
        );
      })}
    </div>
  );
};
