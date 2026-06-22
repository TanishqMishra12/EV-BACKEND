import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTelemetry, getSoH, getRUL, ApiError } from '../api/client';
import DarkChart from '../components/DarkChart';
import StatusDot from '../components/StatusDot';
import { ArrowLeft } from 'lucide-react';

/**
 * BatteryDetailPage — 3-column layout with SoH gauge, telemetry chart, trend/RUL.
 *
 * Data from: /telemetry/{id}?limit=50, /soh/{id}, /rul/{id}
 * Polls every 10 seconds with visibility-aware pausing.
 */

const POLL_INTERVAL = 10_000;

const STATUS_COLORS = {
  healthy: 'var(--accent-green)',
  warning: 'var(--accent-amber)',
  critical: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

export default function BatteryDetailPage() {
  const { batteryId } = useParams();
  const navigate = useNavigate();

  const [telemetry, setTelemetry] = useState(null);
  const [soh, setSoH] = useState(null);
  const [rul, setRul] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState({ telemetry: null, soh: null, rul: null });
  const isFirstLoad = useRef(true);

  const fetchAll = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);

    const newErrors = { telemetry: null, soh: null, rul: null };

    const [telResult, sohResult, rulResult] = await Promise.all([
      getTelemetry(batteryId, 50).catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          return { _authError: true };
        }
        newErrors.telemetry = e.status >= 500 ? 'SERVER ERROR — RETRYING...' : 'CONNECTION ERROR';
        return null;
      }),
      getSoH(batteryId).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return { current_soh_percent: null, status: 'unknown', message: 'No SoH data available yet' };
        newErrors.soh = e.status >= 500 ? 'SERVER ERROR' : null;
        return null;
      }),
      getRUL(batteryId).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return { _pending: true };
        newErrors.rul = e.status >= 500 ? 'SERVER ERROR' : null;
        return null;
      }),
    ]);

    // Handle 401 from any endpoint
    if (telResult?._authError) {
      navigate('/login', { replace: true });
      return;
    }

    if (telResult) setTelemetry(telResult);
    if (sohResult) setSoH(sohResult);
    if (rulResult) {
      if (rulResult._pending) setRul({ _pending: true });
      else setRul(rulResult);
    }

    setErrors(newErrors);
    setLastUpdated(new Date());
    isFirstLoad.current = false;
    setLoading(false);
  }, [batteryId, navigate]);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAll]);

  // Chart data
  const chartData = telemetry?.readings
    ? [...telemetry.readings].reverse().map((r) => ({
        cycle: r.cycle_number,
        voltage_v: r.voltage_v,
        current_a: r.current_a,
        temperature_c: r.temperature_c,
      }))
    : [];

  // SoH trend data
  const sohChartData = soh?.trend?.history?.map((h) => ({
    cycle: h.cycle,
    soh_percent: h.soh_percent,
  })) || [];

  const sohVal = soh?.current_soh_percent;
  const sohStatus = soh?.status || 'unknown';
  const statusColor = STATUS_COLORS[sohStatus] || STATUS_COLORS.unknown;
  const latestReading = telemetry?.readings?.[0];

  // Cycle type breakdown
  const cycleTypes = telemetry?.readings?.reduce((acc, r) => {
    const type = r.cycle_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {}) || {};

  // Loading
  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="scan-line" style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
            LOADING BATTERY {batteryId}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }} className="animate-fadeIn">
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              transition: 'border-color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '0.08em',
              }}>
                BATTERY {batteryId}
              </h2>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: statusColor,
                border: `1px solid ${statusColor}`,
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {sohStatus}
              </span>
              <StatusDot status={sohStatus} size={8} />
            </div>
            {latestReading?.recorded_at && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                LAST SEEN: {new Date(latestReading.recorded_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {lastUpdated && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            LAST UPDATED: {lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── 3-Column Layout ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '30% 40% 30%', gap: '16px' }}>

        {/* ── LEFT COLUMN (30%) ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SoH Vertical Bar */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.06em' }}>
              STATE OF HEALTH
            </div>
            {sohVal != null ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: statusColor, lineHeight: 1, marginBottom: '16px' }}>
                  {sohVal.toFixed(1)}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>%</span>
                </div>
                {/* Vertical segmented bar */}
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-default)', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, sohVal))}%`,
                    backgroundColor: statusColor === 'var(--text-muted)' ? '#4B5563' : statusColor,
                    transition: 'width 500ms',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>0%</span>
                  <span>EOL 70%</span>
                  <span>100%</span>
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-muted)' }}>
                SOH: PENDING
              </div>
            )}
          </div>

          {/* Key Stats */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
              LATEST READINGS
            </div>
            {latestReading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <StatRow label="VOLTAGE" value={latestReading.voltage_v?.toFixed(4)} unit="V" color="var(--accent-cyan)" />
                <StatRow label="CURRENT" value={latestReading.current_a?.toFixed(4)} unit="A" color="var(--accent-green)" />
                <StatRow label="TEMPERATURE" value={latestReading.temperature_c?.toFixed(1)} unit="C" color="var(--accent-amber)" />
              </div>
            ) : (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }} className="blink-block">
                NO DATA — AWAITING TELEMETRY STREAM...
              </span>
            )}
          </div>

          {/* RUL Panel */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.06em' }}>
              REMAINING USEFUL LIFE
            </div>
            {rul?._pending ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent-amber)' }}>
                CALCULATING...
              </div>
            ) : rul?.predicted_rul_cycles != null ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ESTIMATED REMAINING CYCLES:
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                  {rul.predicted_rul_cycles}
                </div>
                {rul.confidence_interval && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    ({rul.confidence_interval.lower_bound} - {rul.confidence_interval.upper_bound}) at {rul.confidence_interval.confidence_percent}% confidence
                  </div>
                )}
                {rul.alert_level && rul.alert_level !== 'none' && (
                  <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <StatusDot status={rul.alert_level === 'warning' ? 'warning' : 'critical'} size={8} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: rul.alert_level === 'warning' ? 'var(--accent-amber)' : 'var(--accent-red)',
                    }}>
                      ALERT: {rul.alert_level.toUpperCase()}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)' }}>
                --
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER COLUMN (40%) ───────────────────────── */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
            TELEMETRY STREAM
          </div>
          {errors.telemetry ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-red)', padding: '40px 0', textAlign: 'center' }}>
              {errors.telemetry}
            </div>
          ) : (
            <DarkChart
              data={chartData}
              xKey="cycle"
              height={400}
              yAxes={[
                { id: 'left', orientation: 'left', domain: [2.5, 4.5] },
                { id: 'right', orientation: 'right', domain: [15, 60] },
              ]}
              lines={[
                { dataKey: 'voltage_v', color: '#00D4FF', name: 'Voltage (V)', yAxisId: 'left' },
                { dataKey: 'current_a', color: '#00FF87', name: 'Current (A)', yAxisId: 'left' },
                { dataKey: 'temperature_c', color: '#F59E0B', name: 'Temperature (C)', yAxisId: 'right' },
              ]}
              showLegend
            />
          )}
        </div>

        {/* ── RIGHT COLUMN (30%) ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SoH Trend */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                SOH TREND
              </span>
              {soh?.trend && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: soh.trend.direction === 'degrading' ? 'var(--accent-red)' : soh.trend.direction === 'improving' ? 'var(--accent-green)' : 'var(--text-muted)',
                  border: `1px solid`,
                  padding: '2px 6px',
                }}>
                  {soh.trend.direction?.toUpperCase()} ({soh.trend.delta_last_10_cycles > 0 ? '+' : ''}{soh.trend.delta_last_10_cycles}%)
                </span>
              )}
            </div>
            <DarkChart
              data={sohChartData}
              xKey="cycle"
              height={160}
              yAxes={[{ id: 'default', domain: [50, 100] }]}
              lines={[{ dataKey: 'soh_percent', color: '#A78BFA', name: 'SoH (%)' }]}
            />
          </div>

          {/* Cycle Type Breakdown */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.06em' }}>
              CYCLE BREAKDOWN
            </div>
            {Object.keys(cycleTypes).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(cycleTypes).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{type}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>--</span>
            )}
          </div>

          {/* Alert Level */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.06em' }}>
              ALERT LEVEL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusDot
                status={
                  rul?.alert_level === 'critical' ? 'critical' :
                  rul?.alert_level === 'warning' ? 'warning' : 'healthy'
                }
                size={10}
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 700,
                color:
                  rul?.alert_level === 'critical' ? 'var(--accent-red)' :
                  rul?.alert_level === 'warning' ? 'var(--accent-amber)' :
                  'var(--accent-green)',
              }}>
                {rul?.alert_level ? rul.alert_level.toUpperCase() : 'NONE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── StatRow helper ──────────────────────────────────────────────────────── */
function StatRow({ label, value, unit, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color }}>
        {value != null ? value : '--'}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>{unit}</span>
      </span>
    </div>
  );
}
