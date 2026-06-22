import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusDot from './StatusDot';

/**
 * BatteryTile — individual tile in the fleet battery grid.
 *
 * Shows battery ID, SoH bar, status dot. Click navigates to detail page.
 * Hover shows cyan border glow.
 */

const STATUS_BAR_COLORS = {
  healthy: 'var(--accent-green)',
  warning: 'var(--accent-amber)',
  critical: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

export default function BatteryTile({ battery }) {
  const navigate = useNavigate();
  const { battery_id, current_soh_percent, status = 'unknown' } = battery;
  const barColor = STATUS_BAR_COLORS[status] || STATUS_BAR_COLORS.unknown;
  const sohVal = current_soh_percent;

  return (
    <button
      onClick={() => navigate(`/battery/${battery_id}`)}
      id={`battery-tile-${battery_id}`}
      style={{
        display: 'block',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 200ms',
        fontFamily: 'var(--font-mono)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      {/* Top row: ID + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {battery_id}
        </span>
        <StatusDot status={status} size={8} />
      </div>

      {/* SoH bar */}
      <div style={{ height: '4px', backgroundColor: 'var(--border-default)', width: '100%' }}>
        <div
          style={{
            height: '100%',
            width: sohVal != null ? `${Math.min(100, Math.max(0, sohVal))}%` : '0%',
            backgroundColor: barColor,
            transition: 'width 500ms',
          }}
        />
      </div>

      {/* SoH value */}
      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        SOH: <span style={{ color: barColor, fontWeight: 700 }}>
          {sohVal != null ? `${sohVal.toFixed(1)}%` : '--'}
        </span>
      </div>
    </button>
  );
}
