import { useEffect, useState } from 'react';
import {
  getMyStudentBloomActivityResponse,
  saveMyStudentBloomActivityResponse,
} from '../../api/personalBloomApi';

const BLOOM_LABEL = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
};

function StudentPersonalBloomActivity({ activity }) {
  const [answer,           setAnswer]           = useState('');
  const [savedAnswer,      setSavedAnswer]      = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState(null);
  const [success,          setSuccess]          = useState(false);
  const [showSuggested,    setShowSuggested]    = useState(false);

  // Load existing response on mount
  useEffect(() => {
    let cancelled = false;
    async function loadResponse() {
      try {
        const response = await getMyStudentBloomActivityResponse(activity.id);
        if (!cancelled) {
          if (response) {
            setSavedAnswer(response.answer);
            setAnswer(response.answer);
          }
        }
      } catch {
        // No response yet — not an error worth displaying
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadResponse();
    return () => { cancelled = true; };
  }, [activity.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const saved = await saveMyStudentBloomActivityResponse({
        activityId: activity.id,
        answer:     answer.trim(),
      });
      setSavedAnswer(saved.answer);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || 'Could not save answer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="personal-bloom-card">
        <span className={`bloom-level-badge bloom-${activity.bloom_level}`}>
          {BLOOM_LABEL[activity.bloom_level] ?? activity.bloom_level}
        </span>
        <p className="practice-loading">Loading…</p>
      </div>
    );
  }

  const isUpdating = savedAnswer !== null;

  return (
    <div className="personal-bloom-card">
      <span className={`bloom-level-badge bloom-${activity.bloom_level}`}>
        {BLOOM_LABEL[activity.bloom_level] ?? activity.bloom_level}
      </span>

      <p className="bloom-activity-prompt">{activity.prompt}</p>

      <form onSubmit={handleSubmit} className="student-answer-area">
        <label
          htmlFor={`answer-${activity.id}`}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}
        >
          Your answer
          <textarea
            id={`answer-${activity.id}`}
            className="student-note-area"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Write your answer here…"
            disabled={saving}
          />
        </label>

        <div className="action-row" style={{ marginTop: '8px' }}>
          <button
            type="submit"
            className="small-button"
            disabled={saving || !answer.trim()}
          >
            {saving ? 'Saving…' : isUpdating ? 'Update answer' : 'Submit answer'}
          </button>

          {activity.expected_answer && (
            <button
              type="button"
              className="small-button secondary-button"
              onClick={() => setShowSuggested((v) => !v)}
              disabled={!isUpdating}
              title={isUpdating ? undefined : 'Submit your answer first to reveal the suggestion'}
            >
              {showSuggested ? 'Hide suggestion' : 'Show suggested answer'}
            </button>
          )}

          {success && (
            <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '600', alignSelf: 'center' }}>
              Saved!
            </span>
          )}
        </div>

        {error && <p className="error" style={{ marginTop: '8px', fontSize: '13px' }}>{error}</p>}
      </form>

      {showSuggested && isUpdating && activity.expected_answer && (
        <div className="bloom-suggested-answer">
          <span className="glossary-meta-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Suggested answer
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {activity.expected_answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default StudentPersonalBloomActivity;
