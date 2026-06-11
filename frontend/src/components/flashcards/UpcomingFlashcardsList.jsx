import { useState } from 'react';

const PAGE_SIZE = 5;

function formatDueDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const RATING_LABELS = {
  again: 'Again',
  hard:  'Hard',
  good:  'Good',
  easy:  'Easy',
};

function UpcomingFlashcardsList({ cards }) {
  const [page, setPage] = useState(0);

  if (!cards || cards.length === 0) {
    return (
      <p style={{ color: 'var(--text-light)', fontStyle: 'italic', margin: 0 }}>
        No upcoming cards scheduled.
      </p>
    );
  }

  const totalPages  = Math.ceil(cards.length / PAGE_SIZE);
  const start       = page * PAGE_SIZE;
  const visible     = cards.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <div className="upcoming-flashcards-list">
        {visible.map((card) => (
          <div key={card.review_state_id} className="upcoming-flashcard-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <span className="upcoming-word">{card.selected_text}</span>
                {card.reading_title && (
                  <span className="upcoming-reading">{card.reading_title}</span>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className="upcoming-date">{formatDueDate(card.due_at)}</span>
                <span className="upcoming-interval">
                  in {card.interval_days} day{card.interval_days !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {card.last_rating && (
              <span className={`flashcard-due-badge rating-badge-${card.last_rating}`}
                style={{ marginTop: '4px', display: 'inline-block' }}>
                Last: {RATING_LABELS[card.last_rating] ?? card.last_rating}
              </span>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="upcoming-pagination">
          <button
            type="button"
            className="upcoming-page-btn"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="upcoming-page-info">
            {start + 1}–{Math.min(start + PAGE_SIZE, cards.length)} of {cards.length}
          </span>
          <button
            type="button"
            className="upcoming-page-btn"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

export default UpcomingFlashcardsList;
