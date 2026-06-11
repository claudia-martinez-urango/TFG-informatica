import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getAllMyGlossaryTermsWithFlashcardStatus,
  ensureFlashcardStateForMyTerm,
  deleteMyFlashcardState,
} from '../../api/flashcardsApi';

// ── Left panel: selected term detail ─────────────────────────

function TermDetail({ term, onAdd, onRemove, adding, removingConfirm, setRemovingConfirm }) {
  if (!term) {
    return (
      <div className="enroll-detail-empty">
        <p>Select a word from the list on the right to preview its details.</p>
      </div>
    );
  }

  return (
    <div className="enroll-detail">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <span className="flashcard-term">{term.selected_text}</span>
        {term.is_mastered && <span className="mastered-badge">Mastered</span>}
        {term.has_flashcard_state && (
          <span className="flashcard-due-badge">In flashcards</span>
        )}
      </div>

      {term.reading_title && (
        <p className="spacing-info" style={{ marginBottom: '12px' }}>
          From: <em>{term.reading_title}</em>
        </p>
      )}

      {term.context_sentence && (
        <div className="flashcard-context" style={{ marginBottom: '12px' }}>
          <span className="glossary-meta-label">Context:</span>{' '}
          &ldquo;{term.context_sentence}&rdquo;
        </div>
      )}

      {term.definition ? (
        <p className="student-glossary-definition">{term.definition}</p>
      ) : (
        <p className="student-glossary-definition" style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>
          No definition available yet.
        </p>
      )}

      {term.spanish_translation && (
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
          <strong>ES:</strong> {term.spanish_translation}
        </p>
      )}

      {term.example_sentence && (
        <p className="glossary-term-example" style={{ marginTop: '8px' }}>
          <span className="glossary-meta-label">Example:</span>{' '}
          {term.example_sentence}
        </p>
      )}

      {term.student_note && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '12px' }}>
          <span className="glossary-meta-label">My note:</span>{' '}
          {term.student_note}
        </p>
      )}

      {/* Card type hint */}
      {term.has_flashcard_state && (
        <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '10px', fontStyle: 'italic' }}>
          {term.spanish_translation
            ? 'Review mode: multiple choice (translation).'
            : 'Review mode: reveal answer (definition only).'}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {!term.has_flashcard_state ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => onAdd(term)}
            disabled={adding}
          >
            {adding ? 'Adding…' : 'Add to flashcards'}
          </button>
        ) : removingConfirm ? (
          <>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remove this card and its review history?</span>
            <button
              type="button"
              className="small-button danger-button"
              onClick={() => onRemove(term)}
            >
              Yes, remove
            </button>
            <button
              type="button"
              className="small-button secondary-button"
              onClick={() => setRemovingConfirm(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="small-button secondary-button"
            onClick={() => setRemovingConfirm(true)}
          >
            Remove from flashcards
          </button>
        )}
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'not_added', label: 'To add'    },
  { key: 'added',     label: 'Added'     },
];

// ── Main panel ────────────────────────────────────────────────

function FlashcardEnrollPanel({ onTermAdded, onTermRemoved }) {
  const [terms,           setTerms]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [selected,        setSelected]        = useState(null);
  const [addingId,        setAddingId]        = useState(null);
  const [removingId,      setRemovingId]      = useState(null);
  const [removingConfirm, setRemovingConfirm] = useState(false);
  const [search,          setSearch]          = useState('');
  const [filter,          setFilter]          = useState('all');
  const [folderFilter,    setFolderFilter]    = useState('all'); // 'all' or a folder_id

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllMyGlossaryTermsWithFlashcardStatus();
      setTerms(data);
    } catch (err) {
      setError(err.message || 'Could not load vocabulary terms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(term) {
    setAddingId(term.id);
    setError(null);
    try {
      await ensureFlashcardStateForMyTerm(term.id);
      setTerms(prev => prev.map(t => t.id === term.id ? { ...t, has_flashcard_state: true } : t));
      setSelected(prev => prev?.id === term.id ? { ...prev, has_flashcard_state: true } : prev);
      setRemovingConfirm(false);
      if (onTermAdded) onTermAdded();
    } catch (err) {
      setError(err.message || 'Could not add to flashcards.');
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemove(term) {
    setRemovingId(term.id);
    setError(null);
    try {
      await deleteMyFlashcardState(term.id);
      setTerms(prev => prev.map(t => t.id === term.id ? { ...t, has_flashcard_state: false, flashcard_state_id: null } : t));
      setSelected(prev => prev?.id === term.id ? { ...prev, has_flashcard_state: false, flashcard_state_id: null } : prev);
      setRemovingConfirm(false);
      if (onTermRemoved) onTermRemoved();
    } catch (err) {
      setError(err.message || 'Could not remove from flashcards.');
    } finally {
      setRemovingId(null);
    }
  }

  function handleSelectTerm(term) {
    setSelected(term);
    setRemovingConfirm(false);
  }

  // Derive unique folders from terms (preserving order: already sorted by lf.name)
  const folders = useMemo(() => {
    const seen = new Set();
    return terms
      .filter(t => t.folder_id && !seen.has(t.folder_id) && seen.add(t.folder_id))
      .map(t => ({ id: t.folder_id, name: t.folder_name || t.folder_id }));
  }, [terms]);

  // Apply folder + status filter + search
  const filtered = useMemo(() => {
    let list = terms;
    if (folderFilter !== 'all') list = list.filter(t => t.folder_id === folderFilter);
    if (filter === 'not_added') list = list.filter(t => !t.has_flashcard_state);
    if (filter === 'added')     list = list.filter(t =>  t.has_flashcard_state);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.selected_text.toLowerCase().includes(q) ||
        (t.reading_title || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [terms, folderFilter, filter, search]);

  // Group by reading title within the filtered set
  const grouped = filtered.reduce((acc, term) => {
    const key = term.reading_title || 'Unknown reading';
    (acc[key] = acc[key] || []).push(term);
    return acc;
  }, {});

  const totalCount = terms.length;
  const addedCount = terms.filter(t => t.has_flashcard_state).length;

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading vocabulary…</p>;
  }

  if (totalCount === 0) {
    return (
      <p style={{ color: 'var(--text-light)', fontSize: '14px', fontStyle: 'italic' }}>
        No personal glossary terms yet. Open a reading and save words to your glossary first.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <strong>{addedCount}</strong> of <strong>{totalCount}</strong> word{totalCount !== 1 ? 's' : ''} added to flashcards.
        Click a word to preview, then use the action button.
      </p>

      <div className="enroll-split-layout">

        {/* ── LEFT: term detail ─────────────────────── */}
        <div className="enroll-detail-panel">
          <TermDetail
            term={selected}
            onAdd={handleAdd}
            onRemove={handleRemove}
            adding={addingId === selected?.id}
            removingId={removingId === selected?.id}
            removingConfirm={removingConfirm}
            setRemovingConfirm={setRemovingConfirm}
          />
        </div>

        {/* ── RIGHT: searchable, filterable word list ── */}
        <div className="enroll-term-list">

          {/* Folder selector — only shown when there are multiple folders */}
          {folders.length > 1 && (
            <div className="enroll-folder-tabs">
              <button
                type="button"
                className={`enroll-folder-tab ${folderFilter === 'all' ? 'enroll-folder-tab--active' : ''}`}
                onClick={() => setFolderFilter('all')}
              >
                All folders
              </button>
              {folders.map(f => {
                const folderTerms  = terms.filter(t => t.folder_id === f.id);
                const folderAdded  = folderTerms.filter(t => t.has_flashcard_state).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`enroll-folder-tab ${folderFilter === f.id ? 'enroll-folder-tab--active' : ''}`}
                    onClick={() => setFolderFilter(f.id)}
                    title={f.name}
                  >
                    <span className="enroll-folder-tab-name">{f.name}</span>
                    <span className="enroll-folder-tab-count">{folderAdded}/{folderTerms.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="enroll-search">
            <input
              type="search"
              className="enroll-search-input"
              placeholder="Search words or readings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter tabs */}
          <div className="enroll-filter-tabs">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                className={`enroll-filter-tab ${filter === f.key ? 'enroll-filter-tab--active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {f.key === 'added'     && addedCount > 0            && ` (${addedCount})`}
                {f.key === 'not_added' && (totalCount - addedCount) > 0 && ` (${totalCount - addedCount})`}
              </button>
            ))}
          </div>

          {/* Word list */}
          <div className="enroll-term-list-body">
            {Object.keys(grouped).length === 0 ? (
              <p style={{ padding: '12px', color: 'var(--text-light)', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>
                No words match your filter.
              </p>
            ) : (
              Object.entries(grouped).map(([readingTitle, readingTerms]) => (
                <div key={readingTitle} className="enroll-reading-group">
                  <div className="enroll-reading-title">
                    {readingTitle}
                    <span style={{ fontWeight: '400', marginLeft: '6px', opacity: 0.7 }}>
                      ({readingTerms.filter(t => t.has_flashcard_state).length}/{readingTerms.length})
                    </span>
                  </div>
                  {readingTerms.map(term => (
                    <button
                      key={term.id}
                      type="button"
                      className={[
                        'enroll-term-item',
                        selected?.id === term.id   ? 'enroll-term-item--selected' : '',
                        term.has_flashcard_state   ? 'enroll-term-item--added'    : '',
                      ].join(' ')}
                      onClick={() => handleSelectTerm(term)}
                    >
                      <span className="enroll-term-word">{term.selected_text}</span>
                      <span className={`enroll-term-status ${term.has_flashcard_state ? 'enroll-term-status--added' : ''}`}>
                        {term.has_flashcard_state ? '✓' : '+'}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default FlashcardEnrollPanel;
