import { useEffect, useState, useCallback } from 'react';
import {
  previewSelectedTermForReading,
  addSelectedTermToMyGlossary,
} from '../../api/studentGlossaryApi';

function SkeletonBlock({ width = '100%', height = 14 }) {
  return <div className="term-panel-skeleton" style={{ width, height }} />;
}

// Props:
//   readingId        — current reading uuid
//   selectedText     — word/phrase selected by student, or undefined
//   contextSentence  — sentence containing the selection
//   savedTerm        — matching entry from the student's personal glossary, or null
//   onTermAdded      — callback fired after a successful add/update
function ReadingTermPanel({ readingId, selectedText, contextSentence, savedTerm, onTermAdded }) {
  const [preview, setPreview]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [adding,  setAdding]      = useState(false);
  const [error,   setError]       = useState(null);
  const [justAdded, setJustAdded] = useState(false);

  // Fetch preview every time the selected word changes
  useEffect(() => {
    if (!selectedText) {
      setPreview(null);
      setError(null);
      setJustAdded(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPreview(null);
    setError(null);
    setJustAdded(false);

    previewSelectedTermForReading({ readingId, selectedText, contextSentence })
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch((err)  => { if (!cancelled) setError(err.message || 'Could not load preview.'); })
      .finally(()   => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [readingId, selectedText, contextSentence]);

  // Reset justAdded when a different word is selected
  useEffect(() => {
    setJustAdded(false);
  }, [selectedText]);

  const handleAdd = useCallback(async () => {
    if (!selectedText || adding) return;
    setAdding(true);
    setError(null);
    try {
      await addSelectedTermToMyGlossary({ readingId, selectedText, contextSentence });
      setJustAdded(true);
      window.getSelection()?.removeAllRanges();
      if (onTermAdded) onTermAdded();
    } catch (err) {
      setError(err.message || 'Could not add term. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [readingId, selectedText, contextSentence, adding, onTermAdded]);

  // ── Empty state ──────────────────────────────────────────────
  if (!selectedText) {
    return (
      <div className="reading-term-panel reading-term-panel-empty">
        <p className="reading-term-panel-hint">
          Select a word or short expression (up to 4 words) from the reading to
          see its definition and save it to your personal glossary.
        </p>
      </div>
    );
  }

  const isMastered = savedTerm?.is_mastered === true;
  const isSaved    = savedTerm != null;

  // ── Filled state ─────────────────────────────────────────────
  return (
    <div className={`reading-term-panel${isMastered ? ' reading-term-panel-is-mastered' : ''}`}>

      {/* ── Header: term + saved/mastered badge ── */}
      <div className="reading-term-panel-header">
        <h3 className="reading-term-panel-term">&ldquo;{selectedText}&rdquo;</h3>

        {isMastered && (
          <span className="mastered-badge" style={{ marginTop: '6px', display: 'inline-block' }}>
            Mastered
          </span>
        )}
        {isSaved && !isMastered && !justAdded && (
          <span className="not-mastered-badge" style={{ marginTop: '6px', display: 'inline-block' }}>
            In your glossary
          </span>
        )}
        {justAdded && !isMastered && (
          <span className="status-badge published-badge" style={{ marginTop: '6px', display: 'inline-block' }}>
            Just added!
          </span>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="reading-term-panel-loading">
          <SkeletonBlock width="55%" height={12} />
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="80%"  height={14} />
          <SkeletonBlock width="100%" height={48} />
        </div>
      )}

      {/* ── Preview content ── */}
      {!loading && preview && (
        <div className="reading-term-panel-body">

          <div className="reading-term-panel-badge-row">
            {preview.source_type === 'teacher_glossary' ? (
              <span className="status-badge published-badge">From teacher glossary</span>
            ) : (
              <span className="status-badge hidden-badge">No teacher definition yet</span>
            )}
          </div>

          <div className="reading-term-panel-section">
            <span className="reading-term-panel-label">Definition</span>
            {preview.definition ? (
              <p className="reading-term-panel-text">{preview.definition}</p>
            ) : (
              <p className="reading-term-panel-text reading-term-panel-text-muted">
                No definition available yet. You can still save this word.
              </p>
            )}
          </div>

          {preview.example_sentence && (
            <div className="reading-term-panel-section">
              <span className="reading-term-panel-label">Example</span>
              <p className="reading-term-panel-text">{preview.example_sentence}</p>
            </div>
          )}

          {preview.context_sentence && (
            <div className="reading-term-panel-section">
              <span className="reading-term-panel-label">In this reading</span>
              <p className="reading-term-panel-text reading-term-panel-context">
                &ldquo;{preview.context_sentence}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Personal note (read-only preview when saved) ── */}
      {!loading && isSaved && savedTerm.student_note && (
        <div className="reading-term-panel-section" style={{ marginTop: '14px' }}>
          <span className="reading-term-panel-label">Your note</span>
          <p className="reading-term-panel-text reading-term-panel-note">
            {savedTerm.student_note}
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p className="error" style={{ margin: '12px 0 0', fontSize: '13px' }}>
          {error}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="reading-term-panel-actions">
        {isMastered ? (
          // ── MASTERED ─────────────────────────────────────────
          <div className="reading-term-panel-mastered-block">
            <p>You have already mastered this word.</p>
            <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.75 }}>
              You can change this from the glossary below.
            </p>
          </div>
        ) : justAdded ? (
          // ── JUST ADDED ───────────────────────────────────────
          <p className="reading-term-panel-success">Added to your glossary!</p>
        ) : isSaved ? (
          // ── ALREADY SAVED, NOT MASTERED ──────────────────────
          <div className="reading-term-panel-already-saved">
            <p>This word is already in your glossary.</p>
            <button
              type="button"
              className="reading-term-panel-add-btn"
              style={{ marginTop: '10px' }}
              onClick={handleAdd}
              disabled={adding || loading}
            >
              {adding ? 'Updating…' : 'Update definition'}
            </button>
          </div>
        ) : (
          // ── NOT SAVED ─────────────────────────────────────────
          <button
            type="button"
            className="reading-term-panel-add-btn"
            onClick={handleAdd}
            disabled={adding || loading}
          >
            {adding ? 'Adding…' : '+ Add to my glossary'}
          </button>
        )}
      </div>

    </div>
  );
}

export default ReadingTermPanel;
