import { useState, useMemo } from 'react';
import { reviewMyFlashcard } from '../../api/flashcardsApi';
import FlashcardMultipleChoice from './FlashcardMultipleChoice';

const RATINGS = [
  { key: 'again', label: 'Again', className: 'rating-again' },
  { key: 'hard',  label: 'Hard',  className: 'rating-hard'  },
  { key: 'good',  label: 'Good',  className: 'rating-good'  },
  { key: 'easy',  label: 'Easy',  className: 'rating-easy'  },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// allCards — the full due-cards array, used to pick MC distractors
function FlashcardReviewCard({ card, onReviewed, allCards = [] }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  // Pick 3 distractors from other due cards that have Spanish translations
  const distractors = useMemo(() => shuffle(
    allCards
      .filter(c => c.review_state_id !== card.review_state_id && c.spanish_translation)
      .map(c => c.spanish_translation)
  ).slice(0, 3), [card.review_state_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use multiple-choice mode when this card has a translation and we
  // have at least 3 distractors from other cards
  const useMultipleChoice = !!card.spanish_translation && distractors.length >= 3;

  if (useMultipleChoice) {
    return (
      <FlashcardMultipleChoice
        card={card}
        distractors={distractors}
        onReviewed={onReviewed}
      />
    );
  }

  // ── Standard reveal mode ─────────────────────────────────────

  async function handleRate(rating) {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await reviewMyFlashcard({ reviewStateId: card.review_state_id, rating });
      onReviewed(updated);
    } catch (err) {
      setError(err.message || 'Could not save your review. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flashcard-review-card">
      <div className="flashcard-front">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="flashcard-term">{card.selected_text}</span>
          <span className="mc-type-badge mc-type-badge--definition">Definition</span>
          {card.is_overdue && <span className="flashcard-overdue-badge">Overdue</span>}
          {!card.is_overdue && card.total_reviews === 0 && <span className="flashcard-due-badge">New</span>}
        </div>

        {card.reading_title && (
          <p className="spacing-info">From: <em>{card.reading_title}</em></p>
        )}

        {card.context_sentence && (
          <div className="flashcard-context">
            <span className="glossary-meta-label">Context:</span>{' '}
            &ldquo;{card.context_sentence}&rdquo;
          </div>
        )}

        <p className="retrieval-hint">Try to recall the meaning before revealing the answer.</p>

        {!showAnswer && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAnswer(true)}
          >
            Show answer
          </button>
        )}
      </div>

      {showAnswer && (
        <div className="flashcard-back">
          <div className="flashcard-answer-section">
            {card.definition ? (
              <p className="student-glossary-definition">{card.definition}</p>
            ) : (
              <p className="student-glossary-definition" style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>
                No definition available.
              </p>
            )}

            {card.spanish_translation && (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0' }}>
                <strong>ES:</strong> {card.spanish_translation}
              </p>
            )}

            {card.example_sentence && (
              <p className="glossary-term-example">
                <span className="glossary-meta-label">Example:</span>{' '}
                {card.example_sentence}
              </p>
            )}

            {card.student_note && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
                <span className="glossary-meta-label">My note:</span>{' '}
                {card.student_note}
              </p>
            )}
          </div>

          {error && <p className="error" style={{ marginTop: '10px' }}>{error}</p>}

          <div className="rating-buttons">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px', fontWeight: '500' }}>
              How well did you recall it?
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {RATINGS.map(({ key, label, className }) => (
                <button
                  key={key}
                  type="button"
                  className={`small-button ${className}`}
                  onClick={() => handleRate(key)}
                  disabled={submitting}
                >
                  {submitting ? '…' : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardReviewCard;
