import { useEffect, useState } from 'react';
import {
  getStudentFolderProgress,
  getStudentBloomStats,
} from '../../api/dashboardApi';
import DashboardBarChart from './DashboardBarChart';

const BLOOM_LABELS = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
};

function StudentAnalyticsPanel() {
  const [folderProgress, setFolderProgress] = useState([]);
  const [bloomStats,     setBloomStats]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [progress, bloom] = await Promise.all([
          getStudentFolderProgress(),
          getStudentBloomStats().catch(() => []),
        ]);
        setFolderProgress(progress);
        setBloomStats(bloom);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bloomWithLabels = bloomStats.map((b) => ({
    ...b,
    label: BLOOM_LABELS[b.bloom_level] || b.bloom_level,
  }));

  return (
    <div className="analytics-panel">
      {loading && <p className="dashboard-loading">Loading analytics…</p>}
      {error   && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="analytics-student-grid">

          {/* ── Mastery per folder ──────────────────────────── */}
          <div className="analytics-student-block">
            <h3 className="analytics-block-title">My Mastery by Folder</h3>
            <p className="analytics-caption">
              Vocabulary mastery rate across your folders.
              Focus on folders with lower percentages.
            </p>
            {folderProgress.length === 0 ? (
              <div className="dashboard-empty-state" style={{ padding: '16px' }}>
                Start opening readings and selecting words to see your progress here.
              </div>
            ) : (
              <>
                <DashboardBarChart
                  data={folderProgress}
                  labelKey="folder_name"
                  valueKey="mastery_rate"
                  maxValue={100}
                  unit="%"
                  color="success"
                />
                <div className="analytics-folder-detail">
                  {folderProgress.map((f) => (
                    <div key={f.folder_id} className="analytics-folder-row">
                      <span className="analytics-folder-name">{f.folder_name}</span>
                      <span className="analytics-folder-counts">
                        {f.terms_mastered} / {f.terms_added} terms mastered
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Bloom activities ─────────────────────────────── */}
          <div className="analytics-student-block">
            <h3 className="analytics-block-title">Bloom Activities by Level</h3>
            <p className="analytics-caption">
              How many activities you have answered at each cognitive level.
              Try to reach higher levels (Analyze, Evaluate, Create).
            </p>
            {bloomWithLabels.length === 0 ? (
              <div className="dashboard-empty-state" style={{ padding: '16px' }}>
                Generate Bloom activities from your personal glossary to see stats here.
              </div>
            ) : (
              <DashboardBarChart
                data={bloomWithLabels}
                labelKey="label"
                valueKey="answered_count"
                color="info"
              />
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default StudentAnalyticsPanel;
