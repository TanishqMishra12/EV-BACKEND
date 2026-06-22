import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFleetSummary, ApiError } from '../api/client';
import MetricCard from '../components/MetricCard';
import BatteryTile from '../components/BatteryTile';
import { Battery, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * DashboardPage — fleet overview with 4 metric cards + 6x3 battery grid.
 *
 * Admin: full fleet summary + battery grid.
 * Operator: fleet summary may 403 → show access denied.
 * Polls every 30 seconds. Silent refresh after initial load.
 */

const POLL_INTERVAL = 30_000;

export default function DashboardPage() {
  const { viewMode, logout } = useAuth();
  const isAdmin = viewMode === 'admin';

  const [fleetData, setFleetData] = useState(null);
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const isFirstLoad = useRef(true);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      // Only show loading state on first load
      if (isFirstLoad.current) {
        setLoading(true);
      }
      setError(null);

      const data = await getFleetSummary();
      setFleetData(data);
      setBatteries(data.batteries || []);
      setLastUpdated(new Date());
      isFirstLoad.current = false;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          logout();
          return;
        }
        if (err.status === 403) {
          setError('ACCESS DENIED');
          isFirstLoad.current = false;
          return;
        }
        if (err.status >= 500) {
          setError('SERVER ERROR — RETRYING...');
          // Retry after 10 seconds on 500
          setTimeout(fetchData, 10_000);
          return;
        }
      }
      // Network error
      if (isFirstLoad.current) {
        setError('CONNECTION ERROR');
      }
      // Keep last known data on subsequent poll failures
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  // Loading state: scanning line
  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="scan-line" style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            LOADING...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !fleetData) {
    return (
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'left' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--accent-red)',
              margin: '0 0 12px 0',
            }}
          >
            {error}
          </p>
          <button
            onClick={fetchData}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              background: 'none',
              border: '1px solid var(--border-default)',
              padding: '8px 16px',
              cursor: 'pointer',
              transition: 'border-color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const statusSummary = fleetData?.status_summary || { healthy: 0, warning: 0, critical: 0 };

  return (
    <div style={{ padding: '24px' }} className="animate-fadeIn">
      {/* ── Last Updated ──────────────────────────────────── */}
      {lastUpdated && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            LAST UPDATED: {lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {/* ── Metric Cards ──────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard
          label="TOTAL BATTERIES"
          value={fleetData?.total_batteries ?? '--'}
          color="var(--accent-cyan)"
          icon={<Battery size={14} />}
        />
        <MetricCard
          label="HEALTHY"
          value={statusSummary.healthy}
          color="var(--accent-green)"
          icon={<CheckCircle size={14} />}
        />
        <MetricCard
          label="WARNING"
          value={statusSummary.warning}
          color="var(--accent-amber)"
          icon={<AlertTriangle size={14} />}
        />
        <MetricCard
          label="CRITICAL"
          value={statusSummary.critical}
          color="var(--accent-red)"
          icon={<AlertTriangle size={14} />}
        />
      </div>

      {/* ── Battery Grid ──────────────────────────────────── */}
      {batteries.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
            className="blink-block"
          >
            NO BATTERIES REGISTERED YET
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '12px',
          }}
        >
          {batteries.map((bat) => (
            <BatteryTile key={bat.battery_id} battery={bat} />
          ))}
        </div>
      )}

      {/* Error banner (for subsequent poll failures — data still showing) */}
      {error && fleetData && (
        <div
          style={{
            marginTop: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
