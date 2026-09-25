import React, { useState, useEffect } from 'react';
import Sidebar, { MobileBottomNav } from './components/Sidebar';
import Header from './components/Header';
import OverviewDashboard from './components/OverviewDashboard';
import UploadSection from './components/UploadSection';
import LiveProcessingTracker from './components/LiveProcessingTracker';
import RecordsExplorer from './components/RecordsExplorer';
import CallQueue from './components/CallQueue';
import UserManagement from './components/UserManagement';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import ForcePasswordChange from './components/ForcePasswordChange';
import JobDetailsView from './components/JobDetailsView';
import ColumnMappingInspector from './components/ColumnMappingInspector';
import AmbientBackdrop from './components/AmbientBackdrop';
import AuthLockScreen from './components/AuthLockScreen';
import { apiFetch, clearSession } from './lib/api';
import { useHashRoute } from './lib/router';
import { navItems } from './lib/nav';

// Every reachable view. `tracker` has no sidebar entry -- an upload hands you
// there -- but it still deserves an address you can refresh and go back from.
const ROUTES = [...navItems.map((i) => i.id), 'tracker'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('datalink_auth') === 'authenticated';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('datalink_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('datalink_theme') || 'dark';
  });

  const [activeTab, setActiveTab] = useHashRoute(ROUTES, 'overview');
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync theme with document classList
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('datalink_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuthenticate = (user) => {
    localStorage.setItem('datalink_auth', 'authenticated');
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('datalink_user', JSON.stringify(user));
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // apiFetch emits this when the API rejects the token (expired, revoked, or
  // the user was deactivated). Without it a stale session keeps rendering the
  // dashboard shell while every request underneath it fails.
  useEffect(() => {
    const onUnauthorized = () => {
      setCurrentUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('datalink:unauthorized', onUnauthorized);
    return () => window.removeEventListener('datalink:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab, 'records']));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/api/dashboard/stats');
      if (!res.ok) {
        setStatsError(`The server answered ${res.status}.`);
        return;
      }
      setStats(await res.json());
      setStatsError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      // Overview otherwise sits on its loading state forever when the API is
      // down, which reads as a hang rather than a reachable failure.
      setStatsError('Could not reach the server.');
    }
  };

  const handleUploadComplete = (jobId) => {
    setActiveJobId(jobId);
    setSelectedJobId(jobId);
    setActiveTab('tracker');
  };

  const handleJobFinished = () => {
    fetchStats();
  };

  // If not authenticated, display the lock screen
  if (!isAuthenticated) {
    return (
      <AuthLockScreen 
        onAuthenticate={handleAuthenticate}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  // The API refuses every route except /auth/me and /auth/password while this
  // is set, so rendering the app would show a wall of failed requests.
  if (currentUser?.must_change_password) {
    return (
      <ForcePasswordChange
        user={currentUser}
        onChanged={(user) => {
          setCurrentUser(user);
          localStorage.setItem('datalink_user', JSON.stringify(user));
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="app-shell relative h-screen w-full text-[var(--text)] overflow-hidden">
      <AmbientBackdrop />

      {/* Fixed Full Screen Layout */}
      <div className="relative z-10 flex w-full h-full overflow-hidden">
        {/* Desktop Persistent Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeJob={activeJobId ? { id: activeJobId, status: 'RUNNING' } : null}
          userRole={currentUser?.role}
        />

        {/* Fixed Content Panel */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <Header
            onRefresh={fetchStats}
            activeJob={activeJobId ? { id: activeJobId, status: 'PROCESSING' } : null}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setActiveTab={setActiveTab}
            theme={theme}
            toggleTheme={toggleTheme}
            onLogout={handleLogout}
            currentUser={currentUser}
          />

          {/* Active View Container (with bottom padding on mobile for the bottom nav) */}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 md:pb-0">
            {visitedTabs.has('overview') && (
              <div className={activeTab === 'overview' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <OverviewDashboard
                  stats={stats}
                  statsError={statsError}
                  onRetry={fetchStats}
                  setActiveTab={setActiveTab}
                  setSelectedJobId={setSelectedJobId}
                  setSearchQuery={setSearchQuery}
                />
              </div>
            )}

            {visitedTabs.has('upload') && (
              <div className={activeTab === 'upload' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <UploadSection
                  onUploadComplete={handleUploadComplete}
                  onNavigate={setActiveTab}
                  activeJob={activeJobId}
                />
              </div>
            )}

            {visitedTabs.has('tracker') && (
              <div className={activeTab === 'tracker' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <LiveProcessingTracker
                  jobId={activeJobId}
                  onJobCompleted={handleJobFinished}
                  setActiveTab={setActiveTab}
                />
              </div>
            )}

            {visitedTabs.has('jobs') && (
              <div className={activeTab === 'jobs' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <JobDetailsView
                  selectedJobId={selectedJobId}
                  setSelectedJobId={setSelectedJobId}
                />
              </div>
            )}

            {visitedTabs.has('records') && (
              <div className={activeTab === 'records' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
                <RecordsExplorer initialQuery={searchQuery} onNavigate={setActiveTab} />
              </div>
            )}

            {visitedTabs.has('queue') && (
              <div className={activeTab === 'queue' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
                <CallQueue />
              </div>
            )}

            {visitedTabs.has('team') && (
              <div className={activeTab === 'team' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <UserManagement currentUser={currentUser} />
              </div>
            )}

            {visitedTabs.has('executive') && (
              <div className={activeTab === 'executive' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <ExecutiveDashboard />
              </div>
            )}

            {visitedTabs.has('mapping') && (
              <div className={activeTab === 'mapping' ? 'flex-1 overflow-y-auto' : 'hidden'}>
                <ColumnMappingInspector />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Native Mobile Bottom Navigation Bar (< md) */}
      <MobileBottomNav
        userRole={currentUser?.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeJob={activeJobId}
      />
    </div>
  );
}
