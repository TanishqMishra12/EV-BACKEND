import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTelemetry, getSoH, getRUL, ApiError } from '../api/client';
import DarkChart from '../components/DarkChart';
import StatusDot from '../components/StatusDot';

/**
 * MyBatteryPage — customer-facing battery lookup with dark industrial aesthetic.
 *
 * Search panel → parallel API calls → 3 result panels:
 *   1. BATTERY HEALTH (SoH + plain language)
 *   2. ESTIMATED RANGE (RUL in plain language)
 *   3. RECENT ACTIVITY (voltage/temp chart)
 *
 * No emoji, no rounded pills, no gradient bars.
 */

const STATUS_MESSAGES = {
  healthy: 'Your battery is in good health',
  warning: 'Your battery needs attention soon',
  critical: 'Your battery requires immediate service',
  unknown: 'Battery health data is being collected',
};

const STATUS_COLORS = {
  healthy: 'var(--accent-green)',
  warning: 'var(--accent-amber)',
  critical: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

export default function MyBatteryPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBatteryId, setActiveBatteryId] = useState(null);

  const [soh, setSoH] = useState(null);
  const [rul, setRul] = useState(null);
  const [telemetry, setTelemetry] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (batteryId) => {
    if (!batteryId) return;

    setLoading(true);
    setError(null);
    setTelemetry(null);
    setSoH(null);
    setRul(null);
    setActiveBatteryId(null);

    try {
      const [telData, sohData, rulData] = await Promise.all([
        getTelemetry(batteryId, 20),
        getSoH(batteryId).catch((e) => {
          if (e instanceof ApiError && e.status === 404) return { current_soh_percent: null, status: 'unknown' };
          return { _error: true };
        }),
        getRUL(batteryId).catch((e) => {
          if (e instanceof ApiError && e.status === 404) return { _pending: true };
          return { _error: true };
        }),
      ]);

      setTelemetry(telData);
      if (!sohData._error) setSoH(sohData);
      if (!rulData._error) {
        if (rulData._pending) setRul({ _pending: true });
        else setRul(rulData);
      }
      setActiveBatteryId(batteryId);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (err.status === 404) {
          setError('NO EV FOUND WITH THIS ID');
          return;
        }
        if (err.status >= 500) {
          setError('SERVER ERROR — RETRYING...');
          setTimeout(() => fetchData(batteryId), 10_000);
          return;
        }
      }
      setError('CONNECTION ERROR');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) fetchData(q);
  };

  const handleClear = () => {
    setSearchQuery('');
    setActiveBatteryId(null);
    setTelemetry(null);
    setSoH(null);
    setRul(null);
    setError(null);
  };

  // Chart data
  const chartData = telemetry?.readings
    ? [...telemetry.readings].reverse().map((r) => ({
        cycle: r.cycle_number,
        voltage: r.voltage_v,
        temp: r.temperature_c,
      }))
    : [];

  const sohVal = soh?.current_soh_percent;
  const sohStatus = soh?.status || 'unknown';
  const statusColor = STATUS_COLORS[sohStatus] || STATUS_COLORS.unknown;

  return (
    <div style={{ padding: '32px 24px', maxWidth: '720px', margin: '0 auto' }}>
      {/* ── Search Panel ──────────────────────────────────── */}
      {!activeBatteryId && !loading && (
        <div style={{ marginBottom: '32px' }}>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'flex', gap: '0' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter your EV ID (e.g. 00001)"
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRight: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  padding: '12px 16px',
                  outline: 'none',
                  transition: 'border-color 200ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                id="customer-search-input"
              />
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0A0A0F',
                  backgroundColor: 'var(--accent-cyan)',
                  border: '1px solid var(--accent-cyan)',
                  padding: '12px 20px',
                  cursor: loading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  opacity: loading || !searchQuery.trim() ? 0.5 : 1,
                }}
                id="customer-search-btn"
              >
                LOOK UP YOUR EV &rarr;
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent-red)', margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="scan-line" style={{ height: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
            LOADING...
          </span>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────── */}
      {activeBatteryId && !loading && (
        <div className="animate-fadeIn">
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 8px 0',
              letterSpacing: '0.08em',
            }}>
              YOUR BATTERY: {activeBatteryId}
            </h2>
            <button
              onClick={handleClear}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-cyan)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                letterSpacing: '0.04em',
              }}
            >
              SEARCH ANOTHER EV
            </button>
          </div>

          {/* ── Panel 1: BATTERY HEALTH ────────────────── */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '24px',
            marginBottom: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
              BATTERY HEALTH
            </div>
            {sohVal != null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '48px', fontWeight: 700, color: statusColor, lineHeight: 1 }}>
                  {sohVal.toFixed(1)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--text-muted)' }}>%</span>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                PENDING
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusDot status={sohStatus} size={8} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                {STATUS_MESSAGES[sohStatus] || STATUS_MESSAGES.unknown}
              </span>
            </div>

            {/* SoH bar */}
            {sohVal != null && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ height: '6px', backgroundColor: 'var(--border-default)', width: '100%' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, sohVal))}%`,
                    backgroundColor: statusColor === 'var(--text-muted)' ? '#4B5563' : statusColor,
                    transition: 'width 500ms',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Panel 2: ESTIMATED RANGE ───────────────── */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '24px',
            marginBottom: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
              ESTIMATED RANGE
            </div>
            {rul?._pending ? (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--accent-amber)', margin: 0 }}>
                Remaining life calculation in progress...
              </p>
            ) : rul?.predicted_rul_cycles != null ? (
              <>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  Approximately{' '}
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {rul.predicted_rul_cycles}
                  </span>{' '}
                  charge cycles remaining
                </p>
                {rul.confidence_interval && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Estimated range: {rul.confidence_interval.lower_bound} - {rul.confidence_interval.upper_bound} cycles
                    ({rul.confidence_interval.confidence_percent}% confidence)
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                --
              </p>
            )}
          </div>

          {/* ── Panel 3: RECENT ACTIVITY ───────────────── */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '24px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
              RECENT ACTIVITY
            </div>
            <DarkChart
              data={chartData}
              xKey="cycle"
              height={220}
              yAxes={[
                { id: 'v', orientation: 'left', domain: [2.5, 4.5] },
                { id: 't', orientation: 'right', domain: [15, 55] },
              ]}
              lines={[
                { dataKey: 'voltage', color: '#00D4FF', name: 'Voltage (V)', yAxisId: 'v' },
                { dataKey: 'temp', color: '#F59E0B', name: 'Temperature (C)', yAxisId: 't' },
              ]}
              showLegend
            />
          </div>
        </div>
      )}
    </div>
  );
}
