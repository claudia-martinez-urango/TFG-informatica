import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReadingDetail } from '../api/readingDetailApi';
import { useAuth } from '../auth/AuthContext';

function ReadingDetailPage() {
  const { readingId } = useParams();
  const { profile } = useAuth();
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getReadingDetail(readingId);
        setReading(data);
      } catch (err) {
        setError(err.message || 'You are not allowed to view this reading.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [readingId]);

  if (loading) {
    return (
      <main className="page">
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Loading reading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <p className="error">{error}</p>
        <Link to="/" className="back-link" style={{ marginTop: '12px', display: 'inline-block' }}>
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const isTeacher = profile?.role === 'teacher';
  const backTo = isTeacher ? '/teacher/folders' : '/student/dashboard';

  return (
    <main className="page reading-detail-layout">
      <div className="reading-detail-header">
        <Link to={backTo} className="back-link">← Back to dashboard</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h1 className="reading-detail-title">{reading.title}</h1>

          {isTeacher && (
            <span
              className={`status-badge ${
                reading.is_visible_to_students ? 'published-badge' : 'hidden-badge'
              }`}
            >
              {reading.is_visible_to_students ? 'Visible to students' : 'Hidden from students'}
            </span>
          )}
        </div>
      </div>

      <div className="reading-meta-card">
        <div className="meta-row">
          <span className="meta-label">Organization</span>
          <span className="meta-value">{reading.organization_name}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Folder</span>
          <span className="meta-value">
            {reading.folder_name}
            {isTeacher && !reading.folder_is_visible_to_students && (
              <span className="status-badge hidden-badge" style={{ marginLeft: '8px' }}>Hidden</span>
            )}
          </span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Section</span>
          <span className="meta-value">
            {reading.section_name}
            {isTeacher && !reading.section_is_visible_to_students && (
              <span className="status-badge hidden-badge" style={{ marginLeft: '8px' }}>Hidden</span>
            )}
          </span>
        </div>
      </div>

      <div className="reading-content-card">
        <p className="reading-detail-content">{reading.content}</p>
      </div>

      <div className="reading-placeholder-card">
        <h2>Glossary terms</h2>
        <p className="placeholder-text">Glossary terms will appear here.</p>
      </div>

      <div className="reading-placeholder-card">
        <h2>Bloom activities</h2>
        <p className="placeholder-text">Bloom activities will appear here.</p>
      </div>
    </main>
  );
}

export default ReadingDetailPage;
