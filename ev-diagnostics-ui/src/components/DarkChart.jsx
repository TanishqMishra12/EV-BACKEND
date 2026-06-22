import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

/**
 * DarkChart — recharts wrapper with consistent dark industrial theme.
 *
 * @param {Array} data — chart data array
 * @param {string} xKey — key for X axis
 * @param {Array<{dataKey: string, color: string, name: string, yAxisId?: string}>} lines
 * @param {number} height — chart height (default 280)
 * @param {Array<{id: string, orientation?: string, domain?: number[]}>} yAxes — Y axis configs
 * @param {boolean} showLegend — show legend (default false)
 */

const TOOLTIP_STYLE = {
  background: '#111827',
  border: '1px solid #1F2937',
  borderRadius: 0,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  color: '#F9FAFB',
};

const LEGEND_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: '#9CA3AF',
};

export default function DarkChart({
  data = [],
  xKey = 'cycle',
  lines = [],
  height = 280,
  yAxes = [],
  showLegend = false,
  xLabel,
}) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <span className="blink-block">NO DATA — AWAITING TELEMETRY STREAM...</span>
      </div>
    );
  }

  // Default single Y axis if none provided
  const axes = yAxes.length > 0
    ? yAxes
    : [{ id: 'default', orientation: 'left' }];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 5 }}>
        <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          stroke="#4B5563"
          tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false}
          axisLine={false}
          label={xLabel ? { value: xLabel, fill: '#4B5563', fontSize: 10, dy: 12, fontFamily: "'JetBrains Mono', monospace" } : undefined}
        />
        {axes.map((axis) => (
          <YAxis
            key={axis.id}
            yAxisId={axis.id}
            orientation={axis.orientation || 'left'}
            domain={axis.domain || ['auto', 'auto']}
            stroke="#4B5563"
            tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={false}
          />
        ))}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: '#1F2937' }}
          labelFormatter={(v) => `${xKey === 'cycle' ? 'Cycle' : ''} ${v}`}
        />
        {showLegend && (
          <Legend wrapperStyle={LEGEND_STYLE} />
        )}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#00D4FF' }}
            yAxisId={line.yAxisId || axes[0]?.id || 'default'}
            name={line.name || line.dataKey}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
