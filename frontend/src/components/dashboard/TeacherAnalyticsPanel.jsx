import { useEffect, useState } from 'react';
import {
  getTeacherAnalyticsByFolder,
  getTeacherDifficultTerms,
} from '../../api/dashboardApi';
import DashboardBarChart from './DashboardBarChart';

const TABS = [
  { id: 'engagement', label: 'Student Engagement' },
  { id: 'mastery',    label: 'Mastery Rate'        },
  { id: 'difficult',  label: 'Difficult Terms'      },
];

function TeacherAnalyticsPanel() {
  const [activeTab,       setActiveTab]       = useState('engagement');
  const [folderAnalytics, setFolderAnalytics] = useState([]);
  const [difficultTerms,  setDifficultTerms]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [analytics, terms] = await Promise.all([
          getTeacherAnalyticsByFolder(),
          getTeacherDifficultTerms(12),
        ]);
        setFolderAnalytics(analytics);
        setDifficultTerms(terms);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="analytics-panel">
      <div className="analytics-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`analytics-tab${activeTab === tab.id ? ' analytics-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="analytics-body">
        {loading && <p className="dashboard-loading">Loading analytics…</p>}
        {error   && <p className="error">{error}</p>}

        {!loading && !error && activeTab === 'engagement' && (
          <div>
            <p className="analytics-caption">
              Number of personal glossary terms students have saved per folder.
              Higher values indicate more active engagement.
            </p>
            <DashboardBarChart
              data={folderAnalytics}
              labelKey="folder_name"
              valueKey="terms_added"
              color="primary"
              emptyMessage="No student activity yet. Students need to join folders and open readings."
            />
          </div>
        )}

        {!loading && !error && activeTab === 'mastery' && (
          <div>
            <p className="analytics-caption">
              Percentage of saved terms that students have marked as mastered per folder.
              Low values indicate where students struggle most.
            </p>
            <DashboardBarChart
              data={folderAnalytics.filter((f) => f.terms_added > 0)}
              labelKey="folder_name"
              valueKey="mastery_rate"
              maxValue={100}
              unit="%"
              color="success"
              emptyMessage="No student glossary terms recorded yet."
            />
          </div>
        )}

        {!loading && !error && activeTab === 'difficult' && (
          <div>
            <p className="analytics-caption">
              Terms from your readings that students struggle with most (lowest mastery rate).
              Consider reviewing these in class.
            </p>
            {difficultTerms.length === 0 ? (
              <div className="dashboard-empty-state" style={{ padding: '16px' }}>
                Not enough student data to identify difficult terms yet.
              </div>
            ) : (
              <div className="analytics-table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Reading</th>
                      <th>Folder</th>
                      <th>Students</th>
                      <th>Mastery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {difficultTerms.map((term, i) => (
                      <tr key={i}>
                        <td className="analytics-table-term">{term.selected_text}</td>
                        <td className="analytics-table-muted">{term.reading_title}</td>
                        <td className="analytics-table-muted">{term.folder_name}</td>
                        <td>{term.students_saved}</td>
                        <td>
                          <span
                            className={`analytics-mastery-badge ${
                              term.mastery_rate === null      ? 'analytics-mastery-badge--none'    :
                              term.mastery_rate < 30         ? 'analytics-mastery-badge--low'      :
                              term.mastery_rate < 70         ? 'analytics-mastery-badge--medium'   :
                                                               'analytics-mastery-badge--high'
                            }`}
                          >
                            {term.mastery_rate !== null ? `${term.mastery_rate}%` : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherAnalyticsPanel;
