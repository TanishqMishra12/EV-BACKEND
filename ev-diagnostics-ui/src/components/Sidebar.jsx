import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getHealth, getReady } from '../api/client';
import StatusDot from './StatusDot';
import { LayoutDashboard, Battery, Settings, LogOut } from 'lucide-react';

/**
 * Sidebar — fixed 240px left sidebar for admin/operator.
 *
 * - Logo / brand
 * - Navigation links (active = cyan left border)
 * - Live system status (DB, SQS, batteries online) — polls /health and /ready
 * - User role badge + logout
 *
 * @param {number|null} batteryCount — total batteries online (from fleet summary)
 */

const HEALTH_POLL_INTERVAL = 30_000;

const NAV_ITEMS = [
  { to: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { to: '/battery', label: 'BATTERIES', icon: Battery },
  { to: '/settings', label: 'SETTINGS', icon: Settings },
];

export default function Sidebar({ batteryCount }) {
  const { viewMode, logout } = useAuth();
  const navigate = useNavigate();

  const [systemStatus, setSystemStatus] = useState({
    health: null,
    db: null,
    sqs: null,
  });

  const fetchSystemStatus = useCallback(async () => {
    try {
      const [healthData, readyData] = await Promise.all([
        getHealth().catch(() => null),
        getReady().catch(() => null),
      ]);

      setSystemStatus({
        health: healthData?.status === 'ok' ? 'ok' : 'degraded',
        db: readyData?.db || null,
        sqs: readyData?.sqs || null,
      });
    } catch {
      setSystemStatus({ health: 'degraded', db: null, sqs: null });
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
    const timer = setInterval(fetchSystemStatus, HEALTH_POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSystemStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSystemStatus]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const viewModeLabel = {
    admin: 'FLEET ADMIN',
    operator: 'OPERATOR',
  }[viewMode] || '';

  const viewModeColor = {
    admin: 'var(--accent-cyan)',
    operator: 'var(--accent-green)',
  }[viewMode] || 'var(--text-muted)';

  const isSystemOk = systemStatus.health === 'ok';

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              letterSpacing: '0.1em',
            }}
          >
            EV PLATFORM
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            v1.0
          </span>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
              backgroundColor: isActive ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
              transition: 'all 150ms',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── System Status ──────────────────────────────────────── */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-default)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            marginBottom: '10px',
            textTransform: 'uppercase',
          }}
        >
          SYSTEM STATUS
        </div>

        {!isSystemOk && systemStatus.health === 'degraded' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <StatusDot status="critical" size={6} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-red)' }}>
              SYSTEM: DEGRADED
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusDot status={systemStatus.db === 'connected' ? 'healthy' : 'unknown'} size={6} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              DB: {systemStatus.db ? systemStatus.db.toUpperCase() : '--'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusDot status={systemStatus.sqs === 'reachable' ? 'healthy' : 'unknown'} size={6} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              SQS: {systemStatus.sqs ? systemStatus.sqs.toUpperCase() : '--'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusDot status={batteryCount != null && batteryCount > 0 ? 'healthy' : 'unknown'} size={6} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              BATTERIES ONLINE: {batteryCount != null ? batteryCount : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* ── User / Logout ──────────────────────────────────────── */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              color: viewModeColor,
              border: `1px solid ${viewModeColor}`,
              padding: '3px 8px',
              letterSpacing: '0.05em',
            }}
          >
            {viewModeLabel}
          </span>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Logout"
          >
            <LogOut size={14} />
            LOGOUT
          </button>
        </div>
      </div>
    </aside>
  );
}
