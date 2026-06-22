import React from 'react';

/**
 * MetricCard — sharp rectangular metric card for the fleet dashboard.
 *
 * @param {string} label — uppercase label text
 * @param {string|number} value — main metric value
 * @param {string} color — CSS color for the value
 * @param {React.ReactNode} icon — lucide icon element (optional)
 */
export default function MetricCard({ label, value, color = 'var(--accent-cyan)', icon }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
          marginBottom: '12px',
        }}
      >
        {icon && <span style={{ display: 'flex' }}>{icon}</span>}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '32px',
          fontWeight: 700,
          color: color,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value ?? '--'}
      </p>
    </div>
  );
}
