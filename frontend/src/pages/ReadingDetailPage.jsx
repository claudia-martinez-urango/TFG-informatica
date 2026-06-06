import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReadingDetail } from '../api/readingDetailApi';
import { getReadingGlossaryTerms } from '../api/glossaryApi';
import { useAuth } from '../auth/AuthContext';

function highlightTerms(content, terms) {
  if (!terms || terms.length === 0) return null;

  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  const escaped = sorted.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const termMap = {};
  terms.forEach((t) => { termMap[t.term.toLowerCase()] = t; });

  const parts = content.split(regex);
  return parts.map((part, i) => {
    const matched = termMap[part.toLowerCase()];
    if (matched) {
      return (
        <u key={i} className="glossary-highlight" title={matched.definition}>
          {part}
        </u>
      );
    }
    return part;
  });
}

function ReadingDetailPage() {
  const { readingId } = useParams();
  const { profile } = useAuth();
  const [reading, setReading] = useState(null);
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [data, terms] = await Promise.all([
          getReadingDetail(readingId),
          getReadingGlossaryTerms(readingId).catch(() => []),
        ]);
        setReading(data);
        setGlossaryTerms(terms);
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

  const visibleTerms = isTeacher
    ? glossaryTerms
    : glossaryTerms.filter((t) => t.is_visible_to_students);

  const contentRendered = highlightTerms(reading.content, visibleTerms) ?? reading.content;

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
        <p className="reading-detail-content">{contentRendered}</p>
      </div>

      {visibleTerms.length > 0 && (
        <div className="reading-glossary-card">
          <h2>Glossary</h2>
          <div className="reading-glossary-list">
            {visibleTerms.map((term) => (
              <div key={term.id} className="reading-glossary-term">
                <div className="reading-glossary-term-header">
                  <strong>{term.term}</strong>
                  {isTeacher && (
                    <span
                      className={`status-badge ${
                        term.is_visible_to_students ? 'published-badge' : 'hidden-badge'
                      }`}
                    >
                      {term.is_visible_to_students ? 'Visible' : 'Hidden'}
                    </span>
                  )}
                </div>
                <p>{term.definition}</p>
                {term.example_sentence && (
                  <p className="glossary-term-example">
                    <span className="glossary-meta-label">Example:</span>{' '}
                    {term.example_sentence}
                  </p>
                )}
                {term.context_sentence && (
                  <p className="glossary-term-context">
                    <span className="glossary-meta-label">Context:</span>{' '}
                    {term.context_sentence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="reading-placeholder-card">
        <h2>Bloom activities</h2>
        <p className="placeholder-text">Bloom activities will appear here.</p>
      </div>
    </main>
  );
}

export default ReadingDetailPage;
