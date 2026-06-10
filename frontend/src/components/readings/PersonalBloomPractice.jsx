import { useCallback, useEffect, useState } from 'react';
import { generatePersonalBloomActivitiesWithAI } from '../../api/aiPersonalBloomApi';
import {
  getMyStudentBloomActivities,
  saveAIGeneratedStudentBloomActivities,
} from '../../api/personalBloomApi';
import StudentPersonalBloomActivity from './StudentPersonalBloomActivity';
import ConfirmModal from '../ui/ConfirmModal';

const ALL_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const LEVEL_LABEL = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
};

function PersonalBloomPractice({ personalTerm, readingTitle, readingExcerpt }) {
  const [activities,       setActivities]       = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [expanded,         setExpanded]         = useState(false);
  const [selectedLevels,   setSelectedLevels]   = useState([...ALL_LEVELS]);
  const [generating,       setGenerating]       = useState(false);
  const [saveError,        setSaveError]        = useState(null);
  const [showConfirmRegen, setShowConfirmRegen] = useState(false);

  // Load existing activities when the section is expanded for the first time
  const loadActivities = useCallback(async () => {
    try {
      const data = await getMyStudentBloomActivities(personalTerm.id);
      setActivities(data);
    } catch {
      // Non-critical: section still renders
    } finally {
      setActivitiesLoaded(true);
    }
  }, [personalTerm.id]);

  useEffect(() => {
    if (expanded && !activitiesLoaded) {
      loadActivities();
    }
  }, [expanded, activitiesLoaded, loadActivities]);

  const toggleLevel = (level) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const runGeneration = async () => {
    setSaveError(null);
    setGenerating(true);
    try {
      const { activities: generated, aiModel } =
        await generatePersonalBloomActivitiesWithAI({
          studentGlossaryTermId: personalTerm.id,
          selectedText:          personalTerm.selected_text,
          definition:            personalTerm.definition    ?? null,
          definitionSource:      personalTerm.definition_source ?? null,
          contextSentence:       personalTerm.context_sentence  ?? null,
          readingTitle,
          readingExcerpt:        readingExcerpt ?? null,
          selectedLevels:        selectedLevels,
        });

      await saveAIGeneratedStudentBloomActivities({
        studentGlossaryTermId: personalTerm.id,
        activities:            generated,
        aiModel,
      });

      // Reload from DB to get full rows with IDs
      const saved = await getMyStudentBloomActivities(personalTerm.id);
      setActivities(saved);
    } catch (err) {
      setSaveError(err.message || 'Could not generate activities. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (activities.length > 0) {
      setShowConfirmRegen(true);
    } else {
      runGeneration();
    }
  };

  const hasActivities = activities.length > 0;

  return (
    <div className="personal-bloom-box">
      {/* ── Header toggle ── */}
      <button
        type="button"
        className="personal-bloom-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="ai-generated-badge">AI</span>
        Personal practice
        <span className="personal-bloom-toggle-arrow">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="personal-bloom-body">
          <p className="personal-bloom-description">
            AI-generated activities based on your selected word.
          </p>

          {/* ── Level selector ── */}
          {!hasActivities && (
            <div className="personal-bloom-controls">
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select levels
              </p>
              <div className="bloom-level-checkboxes">
                {ALL_LEVELS.map((level) => (
                  <label key={level} className="bloom-level-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedLevels.includes(level)}
                      onChange={() => toggleLevel(level)}
                      disabled={generating}
                    />
                    <span className={`bloom-level-badge bloom-${level}`}>
                      {LEVEL_LABEL[level]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Generate button ── */}
          {!hasActivities && (
            <button
              type="button"
              className="personal-bloom-generate-btn"
              onClick={handleGenerate}
              disabled={generating || selectedLevels.length === 0}
            >
              {generating ? 'Generating…' : 'Generate practice with AI'}
            </button>
          )}

          {/* ── Loading ── */}
          {generating && (
            <p className="practice-loading">Generating activities with AI, please wait…</p>
          )}

          {/* ── Error ── */}
          {saveError && !generating && (
            <p className="error" style={{ marginTop: '8px', fontSize: '13px' }}>{saveError}</p>
          )}

          {/* ── Activities list ── */}
          {!generating && hasActivities && (
            <>
              <div className="personal-bloom-activities-list">
                {activities.map((activity) => (
                  <StudentPersonalBloomActivity key={activity.id} activity={activity} />
                ))}
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="small-button secondary-button"
                  onClick={() => setShowConfirmRegen(true)}
                  disabled={generating}
                >
                  Regenerate practice
                </button>
                {saveError && (
                  <p className="error" style={{ marginTop: '8px', fontSize: '13px' }}>{saveError}</p>
                )}
              </div>
            </>
          )}

          {/* ── Empty state: loaded but no activities ── */}
          {!generating && activitiesLoaded && !hasActivities && !saveError && (
            <p className="practice-empty-state">
              No activities yet. Select levels above and generate your personal practice.
            </p>
          )}
        </div>
      )}

      {/* ── Regeneration confirmation modal ── */}
      {showConfirmRegen && (
        <ConfirmModal
          title="Regenerate practice"
          message={`This will replace all current activities and answers for "${personalTerm.selected_text}". Are you sure?`}
          confirmText="Regenerate"
          onConfirm={() => {
            setShowConfirmRegen(false);
            runGeneration();
          }}
          onCancel={() => setShowConfirmRegen(false)}
        />
      )}
    </div>
  );
}

export default PersonalBloomPractice;
