import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyDueFlashcards,
  getMyFlashcardOverview,
  getMyUpcomingFlashcards,
} from '../api/flashcardsApi';
import FlashcardReviewCard from '../components/flashcards/FlashcardReviewCard';
import FlashcardStats from '../components/flashcards/FlashcardStats';
import UpcomingFlashcardsList from '../components/flashcards/UpcomingFlashcardsList';
import FlashcardEnrollPanel from '../components/flashcards/FlashcardEnrollPanel';

function StudentFlashcardsPage() {
  const [dueCards,  setDueCards]  = useState([]);
  const [upcoming,  setUpcoming]  = useState([]);
  const [overview,  setOverview]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  // Track the review_state_id of the card currently being reviewed so we can
  // preserve the user's position after a background refresh of dueCards.
  const activeReviewIdRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cards, stats, upcomingCards] = await Promise.all([
        getMyDueFlashcards(),
        getMyFlashcardOverview(),
        getMyUpcomingFlashcards(20),
      ]);
      setDueCards(cards);
      setOverview(stats);
      setUpcoming(upcomingCards);
      setCardIndex(0);
    } catch (err) {
      setError(err.message || 'Could not load flashcards.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh stats + upcoming + dueCards.
  // Also re-syncs review_state_ids so that remove-then-re-add via the enrollment
  // panel never leaves a stale (deleted) UUID in the active review queue.
  const refreshStats = useCallback(async () => {
    try {
      const [cards, stats, upcomingCards] = await Promise.all([
        getMyDueFlashcards(),
        getMyFlashcardOverview(),
        getMyUpcomingFlashcards(20),
      ]);
      setDueCards(cards);
      setCardIndex(prev => {
        // Try to keep the user on the same card they were reviewing.
        const activeId = activeReviewIdRef.current;
        if (activeId) {
          const newIdx = cards.findIndex(c => c.review_state_id === activeId);
          if (newIdx !== -1) return newIdx;
        }
        // Fall back: clamp to valid range.
        return Math.min(prev, Math.max(0, cards.length - 1));
      });
      setOverview(stats);
      setUpcoming(upcomingCards);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function handleReviewed() {
    const nextIndex = cardIndex + 1;
    if (nextIndex >= dueCards.length) {
      refresh();
    } else {
      setCardIndex(nextIndex);
      refreshStats();
    }
  }

  const currentCard    = dueCards[cardIndex] ?? null;
  // Keep the ref in sync so refreshStats can restore position after re-syncing dueCards.
  activeReviewIdRef.current = currentCard?.review_state_id ?? null;
  const hasOverdue     = overview?.overdue_count > 0;
  const cardsRemaining = dueCards.length - cardIndex;

  return (
    <main className="page flashcards-page">
      <div style={{ marginBottom: '6px' }}>
        <Link to="/student/dashboard" className="back-link">
          ← Back to Dashboard
        </Link>
      </div>

      <h1>Flashcards</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '4px', marginBottom: '24px' }}>
        Review your personal glossary using spaced repetition.
      </p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading your flashcards…</p>
      ) : (
        <>
          {/* ── Stats overview ────────────────────────── */}
          <FlashcardStats overview={overview} />

          {/* ── Overdue friendly notice ───────────────── */}
          {hasOverdue && (
            <div className="flashcard-info-notice" style={{ marginTop: '16px' }}>
              Some cards are overdue. You can review them now when you are ready.
            </div>
          )}

          {/* ── Active review section ─────────────────── */}
          {currentCard ? (
            <section className="section" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0 }}>Cards to review</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {cardIndex + 1} / {dueCards.length}
                  {cardsRemaining > 1 ? ` — ${cardsRemaining - 1} remaining` : ''}
                </span>
              </div>

              <FlashcardReviewCard
                key={currentCard.review_state_id}
                card={currentCard}
                onReviewed={handleReviewed}
                allCards={dueCards}
              />

              {dueCards.length > 1 && (
                <button
                  type="button"
                  className="small-button secondary-button"
                  style={{ marginTop: '12px' }}
                  onClick={handleReviewed}
                >
                  Skip for now
                </button>
              )}
            </section>
          ) : (
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', margin: '0 0 4px' }}>
                No cards due right now.
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                Keep it up! Your next review is scheduled below.
              </p>
            </div>
          )}

          {/* ── Upcoming cards ────────────────────────── */}
          {upcoming.length > 0 && (
            <section className="section" style={{ marginTop: '32px' }}>
              <h2>Upcoming reviews</h2>
              <UpcomingFlashcardsList cards={upcoming} />
            </section>
          )}

          {/* ── Enrollment panel ──────────────────────── */}
          <section className="section" style={{ marginTop: '40px' }}>
            <h2>Add vocabulary to flashcards</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '4px' }}>
              Select words from your personal glossary to include in your spaced repetition review.
            </p>
            <FlashcardEnrollPanel onTermAdded={refreshStats} onTermRemoved={refreshStats} />
          </section>
        </>
      )}
    </main>
  );
}

export default StudentFlashcardsPage;
