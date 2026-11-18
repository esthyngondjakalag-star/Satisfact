import React, { useState } from 'react';

export function LineEvolutionChart({
  data,
  maxValue = 5,
  height = 200,
  emptyLabel = 'Aucune évaluation sur la période',
}: {
  data: { label: string; score: number; count: number }[];
  maxValue?: number;
  height?: number;
  emptyLabel?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-xs text-[#8B9299] bg-[#F9FAFB] rounded-lg border border-dashed border-gray-200">
        {emptyLabel}
      </div>
    );
  }

  const width = 560;
  const padX = 36;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const points = data.map((d, idx) => {
    const x = data.length === 1 ? padX + plotW / 2 : padX + (idx / (data.length - 1)) * plotW;
    const y = padTop + plotH - (Math.min(maxValue, Math.max(0, d.score)) / maxValue) * plotH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
      : '';

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[1, 2, 3, 4, 5].map((tick) => {
          const y = padTop + plotH - (tick / maxValue) * plotH;
          return (
            <g key={tick}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
              <text x={padX - 8} y={y + 4} textAnchor="end" className="fill-[#8B9299] text-[10px] font-mono">
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="#E8F5ED" fillOpacity="0.65" />}
        {points.length > 1 && (
          <path d={linePath} fill="none" stroke="#16834B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, idx) => (
          <g
            key={p.label + idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={hoveredIdx === idx ? 6 : 4.5} fill="#16834B" stroke="#FFFFFF" strokeWidth="2" />
            <text x={p.x} y={height - 8} textAnchor="middle" className="fill-[#8B9299] text-[10px]">
              {p.label}
            </text>
          </g>
        ))}

        {hoveredIdx !== null && points[hoveredIdx] && (
          <g transform={`translate(${Math.min(width - 130, Math.max(10, points[hoveredIdx].x - 55))}, ${Math.max(4, points[hoveredIdx].y - 42)})`}>
            <rect width="115" height="32" rx="6" fill="#27313B" />
            <text x="57" y="14" textAnchor="middle" className="fill-white text-[10px] font-semibold font-mono">
              {points[hoveredIdx].score.toFixed(2)} / {maxValue}
            </text>
            <text x="57" y="26" textAnchor="middle" className="fill-gray-300 text-[9px]">
              {points[hoveredIdx].count} réponse(s)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export function DonutDistributionChart({
  segments,
  centerLabel,
  centerValue,
  emptyLabel = 'Aucune donnée',
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string | number;
  emptyLabel?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-[#8B9299] bg-[#F9FAFB] rounded-lg border border-dashed border-gray-200">
        {emptyLabel}
      </div>
    );
  }

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
          {segments.map((seg) => {
            if (seg.value === 0) return null;
            const dash = (seg.value / total) * circumference;
            const offset = -accumulated;
            accumulated += dash;
            return (
              <circle
                key={seg.label}
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold text-[#27313B] tabular-nums">{centerValue}</span>
          <span className="text-[11px] text-[#8B9299]">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2.5">
        {segments.map((seg) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-[#27313B] font-medium truncate">{seg.label}</span>
              </div>
              <span className="text-[#8B9299] font-mono tabular-nums shrink-0">
                {seg.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorizontalScoreBars({
  items,
  max = 5,
  unit = '/5',
  emptyLabel = 'Aucune donnée disponible',
}: {
  items: { label: string; value: number; subtitle?: string; color?: string }[];
  max?: number;
  unit?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-xs text-[#8B9299] bg-[#F9FAFB] rounded-lg border border-dashed border-gray-200">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / max) * 100));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-[#27313B] truncate">{item.label}</span>
              <span className="font-mono tabular-nums text-[#27313B] font-semibold shrink-0">
                {item.value}
                {unit}
                {item.subtitle ? <span className="text-[#8B9299] font-normal ml-1.5">({item.subtitle})</span> : null}
              </span>
            </div>
            <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: item.color || '#16834B' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrainerMultiComparisonChart({
  trainers,
}: {
  trainers: {
    id: string;
    name: string;
    pedagogie: number | null;
    maitrise: number | null;
    communication: number | null;
    disponibilite: number | null;
    satisfaction: number | null;
    respondentsCount: number;
  }[];
}) {
  if (trainers.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-xs text-[#8B9299] bg-[#F9FAFB] rounded-lg border border-dashed border-gray-200">
        Sélectionnez des formateurs évalués pour comparer leurs critères.
      </div>
    );
  }

  const criteria = [
    { key: 'pedagogie', label: 'Pédagogie' },
    { key: 'maitrise', label: 'Maîtrise technique' },
    { key: 'communication', label: 'Communication' },
    { key: 'disponibilite', label: 'Disponibilité' },
    { key: 'satisfaction', label: 'Satisfaction gén.' },
  ] as const;

  const colors = ['#16834B', '#27313B', '#4B9CD3', '#D97706', '#6B7280'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {trainers.map((t, idx) => (
          <div key={t.id} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
            <span className="font-medium text-[#27313B]">{t.name}</span>
            <span className="text-[#8B9299] tabular-nums">(n={t.respondentsCount})</span>
          </div>
        ))}
      </div>

      <div className="space-y-3.5">
        {criteria.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <div className="text-xs font-medium text-[#27313B]">{c.label}</div>
            <div className="space-y-1">
              {trainers.map((t, idx) => {
                const val = t[c.key] ?? 0;
                const pct = Math.min(100, Math.max(0, (val / 5) * 100));
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: colors[idx % colors.length] }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-[#27313B] w-10 text-right shrink-0">
                      {val > 0 ? val.toFixed(1) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
