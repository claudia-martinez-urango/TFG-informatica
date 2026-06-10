import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReadingDetail } from '../api/readingDetailApi';
import { getReadingGlossaryTerms } from '../api/glossaryApi';
import { updateReadingTranslation, getSectionReadings } from '../api/readingsApi';
import { useAuth } from '../auth/AuthContext';
import SelectableReadingContent from '../components/readings/SelectableReadingContent';
import ReadingTermPanel from '../components/readings/ReadingTermPanel';
import StudentPersonalGlossary from '../components/readings/StudentPersonalGlossary';

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

  // Student-only: currently selected word from the reading
  const [selection, setSelection] = useState(null); // { selectedText, contextSentence }

  // Student-only: mirror of StudentPersonalGlossary's term list so the panel
  // can detect whether the selected word is already saved / mastered
  const [personalTerms, setPersonalTerms] = useState([]);

  // Student-only: drives StudentPersonalGlossary refresh
  const [glossaryRefreshKey, setGlossaryRefreshKey] = useState(0);
  const [addSuccessMessage, setAddSuccessMessage] = useState(null);

  // Teacher-only: translation toggle
  const [translationToggling, setTranslationToggling] = useState(false);
  const [translationError,    setTranslationError]    = useState(null);

  // Navigation: other readings in the same section
  const [sectionReadings, setSectionReadings] = useState([]);

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

  const handleSelectionChange = useCallback(({ selectedText, contextSentence }) => {
    setSelection({ selectedText, contextSentence });
  }, []);

  const handleTermAdded = useCallback(() => {
    setGlossaryRefreshKey((k) => k + 1);
    setAddSuccessMessage('Word added to your personal glossary!');
    setTimeout(() => setAddSuccessMessage(null), 3000);
  }, []);

  // Load sibling readings for navigation once section_id is known
  useEffect(() => {
    if (!reading?.section_id) return;
    getSectionReadings(reading.section_id)
      .then((data) =>
        // Sort oldest-first so navigation follows natural reading order
        setSectionReadings([...data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      )
      .catch(() => setSectionReadings([]));
  }, [reading?.section_id]);

  const handleToggleTranslation = useCallback(async () => {
    if (!reading || translationToggling) return;
    const next = !reading.is_translation_enabled;
    setTranslationToggling(true);
    setTranslationError(null);
    try {
      await updateReadingTranslation({ readingId: reading.reading_id, isTranslationEnabled: next });
      setReading((prev) => ({ ...prev, is_translation_enabled: next }));
    } catch (err) {
      setTranslationError(err.message || 'Could not update translation setting.');
    } finally {
      setTranslationToggling(false);
    }
  }, [reading, translationToggling]);

  // ── Loading / error states ───────────────────────────────────

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
  const isStudent = profile?.role === 'student';
  const backTo    = isTeacher ? '/teacher/folders' : '/student/dashboard';

  const isTranslationEnabled = reading.is_translation_enabled ?? false;

  // Reading navigation
  const currentNavIndex = sectionReadings.findIndex((r) => r.id === readingId);
  const prevReading     = currentNavIndex > 0 ? sectionReadings[currentNavIndex - 1] : null;
  const nextReading     = currentNavIndex < sectionReadings.length - 1 ? sectionReadings[currentNavIndex + 1] : null;

  // Find if the currently selected word already exists in the student's glossary
  const savedTerm = selection?.selectedText
    ? personalTerms.find(
        (t) => t.normalized_term === selection.selectedText.toLowerCase().trim()
      ) ?? null
    : null;

  const visibleTerms = isTeacher
    ? glossaryTerms
    : glossaryTerms.filter((t) => t.is_visible_to_students);

  const contentRendered = highlightTerms(reading.content, visibleTerms) ?? reading.content;

  return (
    <main className="page reading-detail-layout">

      {/* ── Header ── */}
      <div className="reading-detail-header">
        <Link to={backTo} className="back-link">← Back to dashboard</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h1 className="reading-detail-title">{reading.title}</h1>

          {isTeacher && (
            <>
              <span className={`status-badge ${reading.is_visible_to_students ? 'published-badge' : 'hidden-badge'}`}>
                {reading.is_visible_to_students ? 'Visible to students' : 'Hidden from students'}
              </span>

              <button
                type="button"
                className={`small-button translation-toggle-btn ${isTranslationEnabled ? 'translation-toggle-on' : 'translation-toggle-off'}`}
                onClick={handleToggleTranslation}
                disabled={translationToggling}
                title={isTranslationEnabled
                  ? 'Students see Spanish translations. Click to disable.'
                  : 'Click to enable Spanish translations for students.'}
              >
                {translationToggling
                  ? 'Saving…'
                  : isTranslationEnabled
                    ? 'Translation: ON'
                    : 'Translation: OFF'}
              </button>
            </>
          )}
        </div>

        {translationError && (
          <p className="error" style={{ marginTop: '8px', fontSize: '13px' }}>{translationError}</p>
        )}
      </div>

      {/* ── Meta card ── */}
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

      {/* ── Reading navigation ── */}
      {(prevReading || nextReading) && (
        <div className="reading-navigation">
          <div className="reading-nav-slot">
            {prevReading && (
              <Link to={`/reading/${prevReading.id}`} className="reading-nav-btn reading-nav-prev">
                ← {prevReading.title}
              </Link>
            )}
          </div>

          {sectionReadings.length > 1 && (
            <span className="reading-nav-position">
              {currentNavIndex + 1} / {sectionReadings.length}
            </span>
          )}

          <div className="reading-nav-slot reading-nav-slot-right">
            {nextReading && (
              <Link to={`/reading/${nextReading.id}`} className="reading-nav-btn reading-nav-next">
                {nextReading.title} →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      {isStudent ? (
        // Two-column layout: reading on the left, term panel on the right
        <div className="reading-split-layout">

          <div className="reading-split-content">
            <div className="reading-content-card">
              <SelectableReadingContent
                content={reading.content}
                onSelectionChange={handleSelectionChange}
              />
            </div>

            {addSuccessMessage && (
              <p className="success">{addSuccessMessage}</p>
            )}

            <StudentPersonalGlossary
              readingId={readingId}
              refreshKey={glossaryRefreshKey}
              onTermsLoaded={setPersonalTerms}
              readingTitle={reading.title}
              readingExcerpt={reading.content ? reading.content.slice(0, 600) : null}
            />
          </div>

          <div className="reading-split-panel">
            <ReadingTermPanel
              readingId={readingId}
              selectedText={selection?.selectedText}
              contextSentence={selection?.contextSentence}
              savedTerm={savedTerm}
              isTranslationEnabled={isTranslationEnabled}
              onTermAdded={handleTermAdded}
            />
          </div>

        </div>
      ) : (
        // Teacher: plain reading with term highlights
        <div className="reading-content-card">
          <p className="reading-detail-content">{contentRendered}</p>
        </div>
      )}

      {/* ── Teacher / student glossary (full width) ── */}
      {visibleTerms.length > 0 && (
        <div className="reading-glossary-card">
          <h2>Glossary</h2>
          <div className="reading-glossary-list">
            {visibleTerms.map((term) => (
              <div key={term.id} className="reading-glossary-term">
                <div className="reading-glossary-term-header">
                  <strong>{term.term}</strong>
                  {isTeacher && (
                    <span className={`status-badge ${term.is_visible_to_students ? 'published-badge' : 'hidden-badge'}`}>
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


    </main>
  );
}

export default ReadingDetailPage;
