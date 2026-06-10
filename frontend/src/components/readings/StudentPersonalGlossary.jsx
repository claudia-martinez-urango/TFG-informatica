import { useEffect, useState, useCallback } from 'react';
import {
  getMyPersonalGlossaryForReading,
  updateMyPersonalGlossaryTerm,
  deleteMyPersonalGlossaryTerm,
} from '../../api/studentGlossaryApi';
import ConfirmModal from '../ui/ConfirmModal';
import { SourceBadge } from './ReadingTermPanel';
import PersonalBloomPractice from './PersonalBloomPractice';

// onTermsLoaded is called whenever the term list changes so the parent
// (ReadingDetailPage) can check if the current panel selection is already saved.
function StudentPersonalGlossary({ readingId, refreshKey, onTermsLoaded, readingTitle, readingExcerpt }) {
  const [terms,      setTerms]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [savingId,   setSavingId]   = useState(null);
  const [deleteId,   setDeleteId]   = useState(null);
  const [noteValues, setNoteValues] = useState({});
  const [successId,  setSuccessId]  = useState(null);

  // Notify parent whenever the term list changes (load, toggle mastered, delete)
  useEffect(() => {
    if (onTermsLoaded) onTermsLoaded(terms);
  }, [terms, onTermsLoaded]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyPersonalGlossaryForReading(readingId);
      setTerms(data);
      const notes = {};
      data.forEach((t) => { notes[t.id] = t.student_note ?? ''; });
      setNoteValues(notes);
    } catch (err) {
      setError(err.message || 'Could not load personal glossary.');
    } finally {
      setLoading(false);
    }
  }, [readingId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleSaveNote = async (term) => {
    setSavingId(term.id);
    setError(null);
    try {
      const updated = await updateMyPersonalGlossaryTerm({
        termId:      term.id,
        studentNote: noteValues[term.id] || null,
        isMastered:  term.is_mastered,
      });
      setTerms((prev) => prev.map((t) => (t.id === term.id ? { ...t, ...updated } : t)));
      setSuccessId(term.id);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      setError(err.message || 'Could not save note.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleMastered = async (term) => {
    setSavingId(term.id);
    setError(null);
    try {
      const updated = await updateMyPersonalGlossaryTerm({
        termId:      term.id,
        studentNote: noteValues[term.id] || null,
        isMastered:  !term.is_mastered,
      });
      setTerms((prev) => prev.map((t) => (t.id === term.id ? { ...t, ...updated } : t)));
    } catch (err) {
      setError(err.message || 'Could not update term.');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMyPersonalGlossaryTerm(deleteId);
      setTerms((prev) => prev.filter((t) => t.id !== deleteId));
      setNoteValues((prev) => {
        const next = { ...prev };
        delete next[deleteId];
        return next;
      });
    } catch (err) {
      setError(err.message || 'Could not remove term.');
    } finally {
      setDeleteId(null);
    }
  };

  const termToDelete = terms.find((t) => t.id === deleteId);

  return (
    <div className="student-glossary-box">
      <h2>My personal glossary</h2>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
      ) : terms.length === 0 ? (
        <p style={{ color: 'var(--text-light)', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>
          Select words from the reading to build your personal glossary.
        </p>
      ) : (
        <div className="student-glossary-term-list">
          {terms.map((term) => (
            <div key={term.id} className="student-glossary-card">

              <div className="student-glossary-term-header">
                <span className="student-glossary-term">{term.selected_text}</span>
                <span className={term.is_mastered ? 'mastered-badge' : 'not-mastered-badge'}>
                  {term.is_mastered ? 'Mastered' : 'Learning'}
                </span>
              </div>

              <div className="definition-source-row">
                <SourceBadge source={term.definition_source} />
                {term.definition_source === 'dictionary_api' && term.dictionary_part_of_speech && (
                  <span className="dictionary-meta">{term.dictionary_part_of_speech}</span>
                )}
              </div>

              {term.definition ? (
                <p className="student-glossary-definition">{term.definition}</p>
              ) : (
                <p className="student-glossary-definition" style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>
                  No definition available yet.
                </p>
              )}

              {term.example_sentence && (
                <p className="glossary-term-example">
                  <span className="glossary-meta-label">Example:</span>{' '}
                  {term.example_sentence}
                </p>
              )}

              {term.context_sentence && (
                <p className="glossary-term-context">
                  <span className="glossary-meta-label">Context:</span>{' '}
                  &ldquo;{term.context_sentence}&rdquo;
                </p>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginTop: '12px' }}>
                My note
                <textarea
                  className="student-note-area"
                  value={noteValues[term.id] ?? ''}
                  onChange={(e) =>
                    setNoteValues((prev) => ({ ...prev, [term.id]: e.target.value }))
                  }
                  rows={2}
                  placeholder="Add a personal note…"
                />
              </label>

              <div className="action-row" style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="small-button secondary-button"
                  onClick={() => handleSaveNote(term)}
                  disabled={savingId === term.id}
                >
                  {savingId === term.id ? 'Saving…' : 'Save note'}
                </button>

                <button
                  type="button"
                  className={`small-button ${term.is_mastered ? 'secondary-button' : 'success-button'}`}
                  onClick={() => handleToggleMastered(term)}
                  disabled={savingId === term.id}
                >
                  {term.is_mastered ? 'Mark as not mastered' : 'Mark as mastered'}
                </button>

                <button
                  type="button"
                  className="small-button danger-button"
                  onClick={() => setDeleteId(term.id)}
                >
                  Remove
                </button>

                {successId === term.id && (
                  <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '600', alignSelf: 'center' }}>
                    Saved!
                  </span>
                )}
              </div>

              {/* ── AI Bloom Practice for this term ── */}
              <PersonalBloomPractice
                personalTerm={term}
                readingTitle={readingTitle ?? ''}
                readingExcerpt={readingExcerpt ?? null}
              />

            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          title="Remove term"
          message={`Remove "${termToDelete?.selected_text}" from your personal glossary?`}
          confirmText="Remove"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

export default StudentPersonalGlossary;
