import { useEffect, useState, useCallback } from 'react';
import {
  previewSelectedTermForReading,
  addSelectedTermToMyGlossary,
} from '../../api/studentGlossaryApi';
import { fetchDictionaryDefinition, fetchWiktionaryDefinition, fetchTranslation } from '../../api/dictionaryApi';

function SkeletonBlock({ width = '100%', height = 14 }) {
  return <div className="term-panel-skeleton" style={{ width, height }} />;
}

// Shared badge — also imported by StudentPersonalGlossary
export function SourceBadge({ source }) {
  if (source === 'teacher_glossary') {
    return <span className="source-badge source-teacher">Teacher glossary</span>;
  }
  if (source === 'dictionary_api') {
    return <span className="source-badge source-dictionary">Dictionary API</span>;
  }
  return <span className="source-badge source-pending">Pending definition</span>;
}

// Props:
//   readingId            — current reading uuid
//   selectedText         — word/phrase selected by student, or undefined
//   contextSentence      — sentence containing the selection
//   savedTerm            — matching entry from the student's personal glossary, or null
//   isTranslationEnabled — controlled by the teacher; shows Spanish translation when true
//   onTermAdded          — callback fired after a successful add/update
function ReadingTermPanel({
  readingId,
  selectedText,
  contextSentence,
  savedTerm,
  isTranslationEnabled,
  onTermAdded,
}) {
  const [preview,     setPreview]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [adding,      setAdding]      = useState(false);
  const [error,       setError]       = useState(null);
  const [justAdded,   setJustAdded]   = useState(false);
  const [dictResult,  setDictResult]  = useState(null);
  const [translation, setTranslation] = useState(null);

  useEffect(() => {
    if (!selectedText) {
      setPreview(null);
      setError(null);
      setJustAdded(false);
      setDictResult(null);
      setTranslation(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPreview(null);
    setError(null);
    setJustAdded(false);
    setDictResult(null);
    setTranslation(null);

    (async () => {
      try {
        // RPC and translation (if enabled) run in parallel for minimum latency
        const [rpcData, translResult] = await Promise.all([
          previewSelectedTermForReading({ readingId, selectedText, contextSentence }),
          isTranslationEnabled
            ? fetchTranslation(selectedText)
            : Promise.resolve({ found: false }),
        ]);

        if (cancelled) return;

        if (translResult.found) setTranslation(translResult.translation);

        if (rpcData?.source_type === 'no_definition') {
          // 1st attempt: Free Dictionary API (single words only — multi-word returns null
          //              from normalizeDictionaryLookupTerm without making any network call)
          let defResult = await fetchDictionaryDefinition(selectedText);

          // 2nd attempt: Wiktionary covers both single words and multi-word expressions
          if (!defResult.found) {
            if (cancelled) return;
            defResult = await fetchWiktionaryDefinition(selectedText);
          }

          if (cancelled) return;

          if (defResult.found) {
            setDictResult(defResult);
            setPreview({
              ...rpcData,
              definition:                defResult.definition,
              example_sentence:          defResult.example ?? null,
              source_type:               'dictionary_api',
              dictionary_part_of_speech: defResult.partOfSpeech ?? null,
            });
          } else {
            setPreview({ ...rpcData, source_type: 'manual_pending' });
          }
        } else {
          setPreview(rpcData);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [readingId, selectedText, contextSentence, isTranslationEnabled]);

  useEffect(() => { setJustAdded(false); }, [selectedText]);

  const handleAdd = useCallback(async () => {
    if (!selectedText || adding) return;
    setAdding(true);
    setError(null);
    try {
      await addSelectedTermToMyGlossary({
        readingId,
        selectedText,
        contextSentence,
        definition:             dictResult?.definition ?? null,
        definitionSource:       dictResult ? 'dictionary_api' : 'manual_pending',
        dictionaryWord:         dictResult?.word ?? null,
        dictionaryPartOfSpeech: dictResult?.partOfSpeech ?? null,
      });
      setJustAdded(true);
      window.getSelection()?.removeAllRanges();
      if (onTermAdded) onTermAdded();
    } catch (err) {
      setError(err.message || 'Could not add term. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [readingId, selectedText, contextSentence, dictResult, adding, onTermAdded]);

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
          {isTranslationEnabled && <SkeletonBlock width="60%" height={14} />}
          <SkeletonBlock width="100%" height={48} />
        </div>
      )}

      {/* ── Preview content ── */}
      {!loading && preview && (
        <div className="reading-term-panel-body">

          <div className="definition-source-row">
            <SourceBadge source={preview.source_type} />
            {preview.dictionary_part_of_speech && (
              <span className="dictionary-meta">{preview.dictionary_part_of_speech}</span>
            )}
          </div>

          <div className="reading-term-panel-section">
            <span className="reading-term-panel-label">Definition</span>
            {preview.definition ? (
              <p className="reading-term-panel-text">{preview.definition}</p>
            ) : (
              <p className="reading-term-panel-text reading-term-panel-text-muted">
                {translation
                  ? 'No English dictionary definition found for this expression.'
                  : 'No definition available yet. You can still save this word.'}
              </p>
            )}
          </div>

          {/* ── Spanish translation (teacher-enabled) ── */}
          {isTranslationEnabled && translation && (
            <div className="reading-term-panel-section reading-term-panel-translation">
              <span className="reading-term-panel-label">Spanish translation</span>
              <p className="reading-term-panel-text translation-text">{translation}</p>
            </div>
          )}

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
          <div className="reading-term-panel-mastered-block">
            <p>You have already mastered this word.</p>
            <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.75 }}>
              You can change this from the glossary below.
            </p>
          </div>
        ) : justAdded ? (
          <p className="reading-term-panel-success">Added to your glossary!</p>
        ) : isSaved ? (
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
