import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFleetSummary, ApiError } from '../api/client';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * Layout — top-level shell for authenticated pages.
 *
 * - Admin/Operator: fixed left sidebar (240px) + TopBar + Outlet
 * - Customer: no sidebar, TopBar + Outlet (full-width)
 *
 * Layout fetches GET /api/v1/fleet/summary itself so Sidebar and TopBar
 * always have fleet data regardless of which page is active.
 * Operators get 403 → show "--" gracefully.
 */

const FLEET_POLL_INTERVAL = 30_000;

export default function Layout() {
  const { viewMode, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomer = viewMode === 'customer';

  const [batteryCount, setBatteryCount] = useState(null);
  const [fleetAvgSoh, setFleetAvgSoh] = useState(null);

  const fetchFleetData = useCallback(async () => {
    try {
      const data = await getFleetSummary();
      setBatteryCount(data.total_batteries ?? null);
      setFleetAvgSoh(data.fleet_avg_soh_percent ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        // 403 for operators — graceful degradation
        if (err.status === 403) {
          setBatteryCount(null);
          setFleetAvgSoh(null);
          return;
        }
      }
      // Network error or 500 — keep last known values, don't crash
    }
  }, [logout, navigate]);

  useEffect(() => {
    if (!isCustomer) {
      fetchFleetData();
      const timer = setInterval(fetchFleetData, FLEET_POLL_INTERVAL);

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          fetchFleetData();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [isCustomer, fetchFleetData]);

  // Derive page title from current path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'FLEET DASHBOARD';
    if (path.startsWith('/battery/')) return `BATTERY ${path.split('/').pop()}`;
    if (path === '/my-battery') return 'MY BATTERY';
    return '';
  };

  if (isCustomer) {
    // Customer: full-width, no sidebar
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <TopBar pageTitle={getPageTitle()} showLogout={true} />
        <main style={{ overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    );
  }

  // Admin/Operator: sidebar + topbar
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Sidebar batteryCount={batteryCount} />
      <div style={{ marginLeft: 'var(--sidebar-width)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopBar pageTitle={getPageTitle()} fleetAvgSoh={fleetAvgSoh} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
