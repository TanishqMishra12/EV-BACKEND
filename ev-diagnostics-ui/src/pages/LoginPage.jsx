import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import StatusDot from '../components/StatusDot';

/**
 * LoginPage — dark industrial terminal-style login.
 *
 * Full-screen #0A0A0F background, centered compact panel.
 * Three stacked buttons: FLEET ADMIN (cyan), OPERATOR (green), CUSTOMER (amber).
 * No logo, no icons, no decorative imagery — text and geometry only.
 */
export default function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState(null);

  const handleLogin = async (presetRole) => {
    setLoadingRole(presetRole);
    const success = await login(presetRole);
    if (success) {
      navigate(presetRole === 'customer' ? '/my-battery' : '/dashboard', { replace: true });
    }
    setLoadingRole(null);
  };

  const roles = [
    { key: 'admin', label: 'FLEET ADMIN', color: 'var(--accent-cyan)', rawColor: '#00D4FF' },
    { key: 'operator', label: 'OPERATOR', color: 'var(--accent-green)', rawColor: '#00FF87' },
    { key: 'customer', label: 'CUSTOMER', color: 'var(--accent-amber)', rawColor: '#F59E0B' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* ── Login Panel ───────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
          padding: '40px 32px 32px',
        }}
      >
        {/* Title with blinking cursor */}
        <h1
          className="blink-cursor"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--accent-cyan)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 8px 0',
            fontVariant: 'small-caps',
          }}
        >
          EV TELEMETRY PLATFORM
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            margin: '0 0 32px 0',
          }}
        >
          BATTERY DIAGNOSTICS & PREDICTIVE ANALYTICS
        </p>

        {/* Login buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roles.map(({ key, label, color, rawColor }) => {
            const isThisLoading = isLoading && loadingRole === key;
            return (
              <button
                key={key}
                id={`login-btn-${key}`}
                onClick={() => handleLogin(key)}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: isLoading && !isThisLoading ? 'var(--text-muted)' : rawColor,
                  backgroundColor: 'transparent',
                  border: `1px solid ${isLoading && !isThisLoading ? 'var(--border-default)' : rawColor}`,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms',
                  textAlign: 'left',
                  opacity: isLoading && !isThisLoading ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = rawColor;
                    e.currentTarget.style.color = '#0A0A0F';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = rawColor;
                  }
                }}
              >
                {isThisLoading ? 'AUTHENTICATING...' : label}
              </button>
            );
          })}
        </div>

        {/* Error display */}
        {error && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--accent-red)',
              margin: '16px 0 0 0',
            }}
          >
            ERROR: {error}
          </p>
        )}
      </div>

      {/* ── System Status Footer ──────────────────────────────── */}
      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <StatusDot status="healthy" size={6} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}
        >
          SYSTEM STATUS: ONLINE
        </span>
      </div>
    </div>
  );
}
