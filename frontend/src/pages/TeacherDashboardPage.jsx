import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getTeacherDashboardOverview,
  getTeacherFolderOverview,
  getTeacherRecentActivity,
  getTeacherPendingJoinRequests,
} from '../api/dashboardApi';
import {
  approveFolderJoinRequest,
  rejectFolderJoinRequest,
} from '../api/foldersApi';
import DashboardStatCard     from '../components/dashboard/DashboardStatCard';
import TeacherFolderOverview from '../components/dashboard/TeacherFolderOverview';
import RecentActivityList    from '../components/dashboard/RecentActivityList';
import TeacherAnalyticsPanel from '../components/dashboard/TeacherAnalyticsPanel';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function TeacherDashboardPage() {
  const { profile } = useAuth();

  const [overview,       setOverview]       = useState(null);
  const [folderOverview, setFolderOverview] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');

  // ── Quick-action panel state ─────────────────────────────────
  const [activePanel,      setActivePanel]      = useState(null); // 'join_requests' | 'readings'
  const [pendingRequests,  setPendingRequests]  = useState([]);
  const [pendingLoading,   setPendingLoading]   = useState(false);
  const [pendingError,     setPendingError]     = useState('');
  const [requestMsg,       setRequestMsg]       = useState('');

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const [overviewData, foldersData, activityData] = await Promise.all([
          getTeacherDashboardOverview(),
          getTeacherFolderOverview(),
          getTeacherRecentActivity(),
        ]);
        setOverview(overviewData);
        setFolderOverview(foldersData);
        setRecentActivity(activityData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // ── Quick-action panel handlers ───────────────────────────────

  async function handleTogglePanel(panel) {
    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }
    setActivePanel(panel);

    if (panel === 'join_requests') {
      setPendingLoading(true);
      setPendingError('');
      setRequestMsg('');
      try {
        const data = await getTeacherPendingJoinRequests();
        setPendingRequests(data);
      } catch (err) {
        setPendingError(err.message);
      } finally {
        setPendingLoading(false);
      }
    }
  }

  async function handleApprove(requestId) {
    setRequestMsg('');
    try {
      await approveFolderJoinRequest(requestId);
      const [updated, newOverview] = await Promise.all([
        getTeacherPendingJoinRequests(),
        getTeacherDashboardOverview(),
      ]);
      setPendingRequests(updated);
      setOverview(newOverview);
      setRequestMsg('Request approved.');
    } catch (err) {
      setPendingError(err.message);
    }
  }

  async function handleReject(requestId) {
    setRequestMsg('');
    try {
      await rejectFolderJoinRequest(requestId);
      const updated = await getTeacherPendingJoinRequests();
      setPendingRequests(updated);
      setRequestMsg('Request rejected.');
    } catch (err) {
      setPendingError(err.message);
    }
  }

  const pendingCount   = overview?.pending_join_requests ?? 0;
  const recentReadings = recentActivity.filter((a) => a.item_type === 'reading');

  return (
    <main className="page dashboard-layout">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h2>Welcome back, {profile?.first_name} {profile?.last_name}</h2>
          <p>Manage your folders, readings and student learning activity.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="dashboard-loading">Loading dashboard…</p>
      ) : (
        <>
          {/* ── Stats grid ──────────────────────────────────── */}
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Overview</h2>
            <div className="dashboard-stats-grid">
              <DashboardStatCard label="Total Folders"       value={overview?.total_folders}         />
              <DashboardStatCard label="Visible Folders"     value={overview?.visible_folders}        variant="success" />
              <DashboardStatCard label="Hidden Folders"      value={overview?.hidden_folders}         variant="muted"   />
              <DashboardStatCard label="Total Students"      value={overview?.total_students}         variant="primary" />
              <DashboardStatCard
                label="Pending Requests"
                value={pendingCount}
                variant={pendingCount > 0 ? 'warning' : undefined}
              />
              <DashboardStatCard label="Total Sections"     value={overview?.total_sections}          />
              <DashboardStatCard label="Total Readings"     value={overview?.total_readings}           />
              <DashboardStatCard label="Published Readings" value={overview?.published_readings}       variant="success" />
              <DashboardStatCard label="Glossary Terms"     value={overview?.total_glossary_terms}     />
              <DashboardStatCard label="Visible Terms"      value={overview?.visible_glossary_terms}   variant="success" />
              <DashboardStatCard
                label="Student Personal Terms"
                value={overview?.student_personal_terms_count}
                helperText="Across all folders"
              />
              <DashboardStatCard
                label="Flashcard Reviews"
                value={overview?.flashcard_reviews_count}
                helperText="By students"
              />
              <DashboardStatCard
                label="Bloom Responses"
                value={overview?.bloom_responses_count}
                helperText="By students"
              />
            </div>
          </section>

          {/* ── Quick actions ────────────────────────────────── */}
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Quick Actions</h2>
            <div className="dashboard-quick-actions">

              {/* Card 1: Manage Folders → navigate */}
              <Link to="/teacher/folders" className="dashboard-action-card dashboard-action-card--primary">
                <div className="dashboard-action-label">Manage Folders</div>
                <div className="dashboard-action-desc">
                  Create folders, manage sections and readings.
                </div>
              </Link>

              {/* Card 2: Join Requests → expandable panel */}
              <button
                type="button"
                className={`dashboard-action-card dashboard-action-card--btn${
                  pendingCount > 0 ? ' dashboard-action-card--warning' : ''
                }${activePanel === 'join_requests' ? ' dashboard-action-card--active' : ''}`}
                onClick={() => handleTogglePanel('join_requests')}
              >
                <div className="dashboard-action-label">
                  Join Requests
                  {pendingCount > 0 && (
                    <span className="action-badge">{pendingCount}</span>
                  )}
                </div>
                <div className="dashboard-action-desc">
                  Approve or reject pending student requests.
                </div>
              </button>

              {/* Card 3: Recent Readings → expandable panel */}
              <button
                type="button"
                className={`dashboard-action-card dashboard-action-card--btn${
                  activePanel === 'readings' ? ' dashboard-action-card--active' : ''
                }`}
                onClick={() => handleTogglePanel('readings')}
              >
                <div className="dashboard-action-label">Recent Readings</div>
                <div className="dashboard-action-desc">
                  Open recently created readings.
                </div>
              </button>

              {/* Card 4: Manage Glossary → navigate */}
              <Link to="/teacher/folders" className="dashboard-action-card">
                <div className="dashboard-action-label">Manage Glossary</div>
                <div className="dashboard-action-desc">
                  Add and publish vocabulary terms for readings.
                </div>
              </Link>

            </div>

            {/* ── Expandable: Join Requests panel ─────────────── */}
            {activePanel === 'join_requests' && (
              <div className="quick-panel">
                <div className="quick-panel-header">
                  <h3>Pending Join Requests</h3>
                  <button type="button" className="quick-panel-close" onClick={() => setActivePanel(null)}>✕</button>
                </div>
                {pendingLoading && <p className="dashboard-loading">Loading…</p>}
                {pendingError  && <p className="error">{pendingError}</p>}
                {requestMsg    && <p className="success" style={{ margin: '8px 16px 0' }}>{requestMsg}</p>}
                {!pendingLoading && pendingRequests.length === 0 && (
                  <p className="quick-panel-empty">No pending join requests right now.</p>
                )}
                {!pendingLoading && pendingRequests.map((req) => (
                  <div key={req.request_id} className="quick-panel-item">
                    <div className="quick-panel-item-info">
                      <span className="quick-panel-item-name">
                        {req.first_name} {req.last_name}
                      </span>
                      <span className="quick-panel-item-meta">
                        {req.folder_name} · {formatDate(req.requested_at)}
                      </span>
                    </div>
                    <div className="quick-panel-item-actions">
                      <button
                        type="button"
                        className="quick-panel-approve"
                        onClick={() => handleApprove(req.request_id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="quick-panel-reject"
                        onClick={() => handleReject(req.request_id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Expandable: Recent Readings panel ────────────── */}
            {activePanel === 'readings' && (
              <div className="quick-panel">
                <div className="quick-panel-header">
                  <h3>Recent Readings</h3>
                  <button type="button" className="quick-panel-close" onClick={() => setActivePanel(null)}>✕</button>
                </div>
                {recentReadings.length === 0 && (
                  <p className="quick-panel-empty">No readings created yet.</p>
                )}
                {recentReadings.map((item) => (
                  <div key={item.item_id} className="quick-panel-item">
                    <div className="quick-panel-item-info">
                      <span className="quick-panel-item-name">{item.title}</span>
                      <span className="quick-panel-item-meta">
                        {item.subtitle} · {formatDate(item.created_at)}
                      </span>
                    </div>
                    <Link
                      to="/teacher/folders"
                      className="quick-panel-open"
                    >
                      Open folder
                    </Link>
                  </div>
                ))}
                <div className="quick-panel-footer">
                  <Link to="/teacher/folders">Go to Folders →</Link>
                </div>
              </div>
            )}
          </section>

          {/* ── Folder overview (full width) ─────────────────── */}
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Folder Overview</h2>
            <TeacherFolderOverview folders={folderOverview} />
          </section>

          {/* ── Recent activity ───────────────────────────────── */}
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Recent Activity</h2>
            <RecentActivityList activities={recentActivity} />
          </section>

          {/* ── Analytics ────────────────────────────────────── */}
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Student Analytics</h2>
            <p className="analytics-caption" style={{ marginBottom: '16px' }}>
              Understand how students are engaging with your content and where they need more support.
            </p>
            <TeacherAnalyticsPanel />
          </section>
        </>
      )}
    </main>
  );
}

export default TeacherDashboardPage;
