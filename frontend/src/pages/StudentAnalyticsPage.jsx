import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getStudentAnalyticsFilters,
  getStudentAnalyticsSummary,
  getStudentAnalyticsTerms,
  getStudentAnalyticsBloom,
} from '../api/analyticsApi';
import DashboardStatCard from '../components/dashboard/DashboardStatCard';
import DashboardBarChart from '../components/dashboard/DashboardBarChart';

const BLOOM_LABELS = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
};

function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildProgressData(terms, folderId, sectionId) {
  const map = {};
  for (const t of terms) {
    const key   = sectionId ? t.reading_id   : folderId ? t.section_id  : t.folder_id;
    const label = sectionId ? t.reading_title : folderId ? t.section_name : t.folder_name;
    if (!map[key]) map[key] = { id: key, label, total: 0, mastered: 0 };
    map[key].total++;
    if (t.is_mastered) map[key].mastered++;
  }
  return Object.values(map)
    .map(g => ({
      id:           g.id,
      label:        g.label,
      mastery_rate: g.total > 0 ? Math.round((g.mastered / g.total) * 100) : 0,
      terms_added:  g.total,
    }))
    .sort((a, b) => a.mastery_rate - b.mastery_rate);
}

function masteryBadgeClass(rate) {
  if (rate === null || rate === undefined) return 'analytics-mastery-badge analytics-mastery-badge--low';
  if (rate >= 70) return 'analytics-mastery-badge analytics-mastery-badge--high';
  if (rate >= 30) return 'analytics-mastery-badge analytics-mastery-badge--medium';
  return 'analytics-mastery-badge analytics-mastery-badge--low';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StudentAnalyticsPage() {
  const { profile } = useAuth();

  const [filterData,       setFilterData]       = useState([]);
  const [selectedFolder,   setSelectedFolder]   = useState('');
  const [selectedSection,  setSelectedSection]  = useState('');
  const [selectedReading,  setSelectedReading]  = useState('');
  const [summary,          setSummary]          = useState(null);
  const [terms,            setTerms]            = useState([]);
  const [bloom,            setBloom]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [dataLoading,      setDataLoading]      = useState(false);

  // ── Cascade dropdown options ─────────────────────────────────
  const folders = useMemo(
    () => uniqueBy(filterData, 'folder_id').map(r => ({ id: r.folder_id, name: r.folder_name })),
    [filterData]
  );

  const sections = useMemo(() => {
    const f = selectedFolder ? filterData.filter(r => r.folder_id === selectedFolder) : filterData;
    return uniqueBy(f, 'section_id').map(r => ({ id: r.section_id, name: r.section_name }));
  }, [filterData, selectedFolder]);

  const readings = useMemo(() => {
    let f = filterData;
    if (selectedFolder)  f = f.filter(r => r.folder_id  === selectedFolder);
    if (selectedSection) f = f.filter(r => r.section_id === selectedSection);
    return uniqueBy(f, 'reading_id').map(r => ({ id: r.reading_id, title: r.reading_title }));
  }, [filterData, selectedFolder, selectedSection]);

  // ── Load filter options on mount ─────────────────────────────
  useEffect(() => {
    getStudentAnalyticsFilters()
      .then(setFilterData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Reload analytics data when filters change ─────────────────
  useEffect(() => {
    async function load() {
      setDataLoading(true);
      try {
        const fId = selectedFolder  || null;
        const sId = selectedSection || null;
        const rId = selectedReading || null;
        const [summaryData, termsData, bloomData] = await Promise.all([
          getStudentAnalyticsSummary(fId, sId, rId),
          getStudentAnalyticsTerms(fId, sId, rId),
          getStudentAnalyticsBloom(fId, sId, rId),
        ]);
        setSummary(summaryData);
        setTerms(termsData);
        setBloom(bloomData);
      } catch {
        // non-critical, fail silently
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, [selectedFolder, selectedSection, selectedReading]);

  // ── Filter handlers ──────────────────────────────────────────
  function onFolderChange(e) {
    setSelectedFolder(e.target.value);
    setSelectedSection('');
    setSelectedReading('');
  }
  function onSectionChange(e) {
    setSelectedSection(e.target.value);
    setSelectedReading('');
  }
  function onReset() {
    setSelectedFolder('');
    setSelectedSection('');
    setSelectedReading('');
  }

  // ── Derived chart data ───────────────────────────────────────
  const progressData = useMemo(
    () => buildProgressData(terms, selectedFolder, selectedSection),
    [terms, selectedFolder, selectedSection]
  );

  const bloomChartData = useMemo(
    () => bloom.map(b => ({
      label:         BLOOM_LABELS[b.bloom_level] ?? b.bloom_level,
      answered_count: b.answered_count,
    })),
    [bloom]
  );

  const hasActiveFilter = selectedFolder || selectedSection || selectedReading;

  function onProgressBarClick(item) {
    if (!selectedFolder) {
      setSelectedFolder(item.id);
    } else if (!selectedSection) {
      setSelectedSection(item.id);
    } else if (!selectedReading) {
      setSelectedReading(item.id);
    }
  }

  const progressChartTitle =
    selectedReading ? 'Terms in this Reading' :
    selectedSection ? 'Mastery by Reading' :
    selectedFolder  ? 'Mastery by Section' :
                      'Mastery by Folder';

  if (loading) {
    return (
      <main className="page">
        <p style={{ color: 'var(--text-muted)', padding: '40px 24px' }}>Loading analytics…</p>
      </main>
    );
  }

  return (
    <main className="page analytics-page">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h2>My Analytics</h2>
          <p>Track your vocabulary mastery and Bloom activity progress{profile?.first_name ? `, ${profile.first_name}` : ''}.</p>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <section className="analytics-filter-section">
        <div className="analytics-filter-bar">

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Folder</label>
            <select className="analytics-filter-select" value={selectedFolder} onChange={onFolderChange}>
              <option value="">All Folders</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Unit / Section</label>
            <select
              className="analytics-filter-select"
              value={selectedSection}
              onChange={onSectionChange}
              disabled={!selectedFolder}
            >
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Reading</label>
            <select
              className="analytics-filter-select"
              value={selectedReading}
              onChange={e => setSelectedReading(e.target.value)}
              disabled={!selectedSection}
            >
              <option value="">All Readings</option>
              {readings.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>

          {hasActiveFilter && (
            <button type="button" className="analytics-filter-reset" onClick={onReset}>
              ✕ Reset
            </button>
          )}
        </div>
      </section>

      {dataLoading && (
        <p className="analytics-loading-hint">Updating…</p>
      )}

      {/* ── Summary cards ─────────────────────────────────────── */}
      {summary && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Overview</h2>
          <div className="dashboard-stats-grid">
            <DashboardStatCard label="Total Terms"    value={summary.total_terms}    />
            <DashboardStatCard label="Mastered"       value={summary.mastered_terms} variant="success" />
            <DashboardStatCard
              label="To Master"
              value={summary.not_mastered_terms}
              variant={summary.not_mastered_terms > 0 ? 'warning' : undefined}
            />
            <DashboardStatCard
              label="Mastery Rate"
              value={summary.mastery_rate !== null ? `${summary.mastery_rate}%` : '—'}
              variant="success"
            />
            <DashboardStatCard label="Bloom Activities" value={summary.bloom_answers} />
          </div>
        </section>
      )}

      {/* ── Charts ────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="analytics-charts-grid">

          {/* Vocabulary progress */}
          <div className="analytics-chart-block">
            <h3 className="analytics-chart-title">{progressChartTitle}</h3>
            {selectedReading ? (
              <p className="analytics-chart-caption">
                See all terms for this reading in the table below.
              </p>
            ) : progressData.length === 0 ? (
              <p className="analytics-chart-caption">No vocabulary data yet.</p>
            ) : (
              <>
                <DashboardBarChart
                  data={progressData}
                  labelKey="label"
                  valueKey="mastery_rate"
                  unit="%"
                  color="success"
                  emptyMessage="No data yet."
                  onBarClick={onProgressBarClick}
                />
                <p className="analytics-click-hint">
                  Click a bar to filter by {!selectedFolder ? 'folder' : !selectedSection ? 'section' : 'reading'}.
                </p>
              </>
            )}
          </div>

          {/* Bloom activities */}
          <div className="analytics-chart-block">
            <h3 className="analytics-chart-title">Bloom Activity Completion</h3>
            {bloomChartData.length === 0 ? (
              <p className="analytics-chart-caption">No Bloom activities recorded yet.</p>
            ) : (
              <DashboardBarChart
                data={bloomChartData}
                labelKey="label"
                valueKey="answered_count"
                color="primary"
                emptyMessage="No Bloom activities yet."
              />
            )}
          </div>

        </div>
      </section>

      {/* ── Terms table ───────────────────────────────────────── */}
      {terms.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">
            My Terms
            <span className="analytics-count-badge">{terms.length}</span>
          </h2>
          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Definition</th>
                  <th>Reading</th>
                  <th>Section</th>
                  <th>Folder</th>
                  <th>Status</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {terms.map(t => (
                  <tr key={t.term_id}>
                    <td><strong>{t.selected_text}</strong></td>
                    <td className="analytics-table-def">{t.definition || '—'}</td>
                    <td>{t.reading_title}</td>
                    <td>{t.section_name}</td>
                    <td>{t.folder_name}</td>
                    <td>
                      <span className={t.is_mastered
                        ? 'analytics-mastery-badge analytics-mastery-badge--high'
                        : 'analytics-mastery-badge analytics-mastery-badge--low'
                      }>
                        {t.is_mastered ? 'Mastered' : 'To Learn'}
                      </span>
                    </td>
                    <td className="analytics-table-date">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state when no terms at all */}
      {!dataLoading && summary && summary.total_terms === 0 && (
        <section className="dashboard-section">
          <div className="dashboard-empty-state">
            You have not saved any vocabulary terms yet.
            Open a reading, select a word, and add it to your personal glossary to get started.
          </div>
        </section>
      )}

    </main>
  );
}

export default StudentAnalyticsPage;
