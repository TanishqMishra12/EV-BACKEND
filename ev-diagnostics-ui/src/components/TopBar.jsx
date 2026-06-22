import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

/**
 * TopBar — thin bar across the top of the main content area.
 *
 * - Left: page title (monospace, uppercase)
 * - Right: live clock (HH:MM:SS, updates every second) + fleet avg SoH + optional logout
 *
 * @param {string} pageTitle
 * @param {number|null} fleetAvgSoh — fleet average SoH percent
 * @param {boolean} showLogout — whether to show a logout button on the right (for customer view)
 */
export default function TopBar({ pageTitle = '', fleetAvgSoh, showLogout = false }) {
  const [time, setTime] = useState(formatTime());
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* Page title */}
      <h1
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {pageTitle}
      </h1>

      {/* Right side: fleet stat + clock + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {fleetAvgSoh != null && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
            }}
          >
            FLEET AVG SOH:{' '}
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
              {fleetAvgSoh.toFixed(1)}%
            </span>
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}
        >
          {time}
        </span>
        
        {showLogout && (
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
        )}
      </div>
    </header>
  );
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
