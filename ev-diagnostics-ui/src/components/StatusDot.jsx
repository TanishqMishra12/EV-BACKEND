import React from 'react';

/**
 * StatusDot — tiny status indicator with optional pulse animation.
 *
 * @param {"healthy"|"warning"|"critical"|"unknown"} status
 * @param {number} size — px diameter (default 8)
 */

const STATUS_COLORS = {
  healthy: 'var(--accent-green)',
  warning: 'var(--accent-amber)',
  critical: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

export default function StatusDot({ status = 'unknown', size = 8 }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const isPulsing = status === 'critical';

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
      className={isPulsing ? 'status-dot-pulse' : ''}
      aria-label={`Status: ${status}`}
    />
  );
}
