import { useState, useMemo } from 'react';
import { reviewMyFlashcard } from '../../api/flashcardsApi';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CONFIDENCE_RATINGS = [
  { key: 'hard', label: 'I guessed',  className: 'rating-hard' },
  { key: 'good', label: 'I knew it',  className: 'rating-good' },
  { key: 'easy', label: 'Very easy',  className: 'rating-easy' },
];

function FlashcardMultipleChoice({ card, distractors, onReviewed }) {
  const [selected,   setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  // Shuffle options once on mount — stable across re-renders
  const options = useMemo(() => shuffle([
    { value: card.spanish_translation, isCorrect: true },
    ...distractors.map(d => ({ value: d, isCorrect: false })),
  ]), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitRating(rating) {
    setSubmitting(true);
    try {
      const updated = await reviewMyFlashcard({
        reviewStateId: card.review_state_id,
        rating,
      });
      // Brief pause so the student sees wrong-answer highlight before card advances
      setTimeout(() => onReviewed(updated), rating === 'again' ? 1200 : 0);
    } catch (err) {
      setError(err.message || 'Could not save review.');
      setSubmitting(false);
    }
  }

  function handleSelect(opt) {
    if (selected || submitting) return;
    setSelected(opt);
    if (!opt.isCorrect) {
      submitRating('again');
    }
    // Correct → show confidence buttons, student picks Hard / Good / Easy
  }

  function optionClass(opt) {
    if (!selected) return 'mc-option';
    if (opt.isCorrect) return 'mc-option mc-option--correct';
    if (opt === selected) return 'mc-option mc-option--wrong';
    return 'mc-option mc-option--disabled';
  }

  return (
    <div className="flashcard-review-card flashcard-review-card--mc">
      <div className="flashcard-front">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="flashcard-term">{card.selected_text}</span>
          <span className="mc-type-badge">Translation</span>
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

        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', margin: '14px 0 8px' }}>
          Choose the correct Spanish translation:
        </p>

        {/* Options */}
        <div className="mc-options">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={optionClass(opt)}
              onClick={() => handleSelect(opt)}
              disabled={!!selected || submitting}
            >
              {opt.value}
            </button>
          ))}
        </div>

        {/* Wrong answer feedback */}
        {selected && !selected.isCorrect && (
          <p className="mc-feedback mc-feedback--wrong">
            {submitting ? 'Updating…' : 'Incorrect — this card will come back soon.'}
          </p>
        )}

        {/* Correct answer: show confidence rating buttons */}
        {selected?.isCorrect && (
          <>
            <p className="mc-feedback mc-feedback--correct">Correct!</p>
            <div className="rating-buttons" style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 8px', fontWeight: '500' }}>
                How confident were you?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CONFIDENCE_RATINGS.map(({ key, label, className }) => (
                  <button
                    key={key}
                    type="button"
                    className={`small-button ${className}`}
                    onClick={() => submitRating(key)}
                    disabled={submitting}
                  >
                    {submitting ? '…' : label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="error" style={{ marginTop: '10px' }}>{error}</p>}
      </div>
    </div>
  );
}

export default FlashcardMultipleChoice;
