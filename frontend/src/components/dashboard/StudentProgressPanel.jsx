function ProgressBar({ percent, variant }) {
  const clampedPercent = Math.min(100, Math.max(0, percent || 0));
  return (
    <div className="progress-bar">
      <div
        className={`progress-bar-fill${variant ? ` progress-bar-fill--${variant}` : ''}`}
        style={{ width: `${clampedPercent}%` }}
      />
    </div>
  );
}

function StudentProgressPanel({ totalTerms, masteredTerms, reviewedToday, dueToday }) {
  const termPercent   = totalTerms > 0 ? Math.round((masteredTerms / totalTerms) * 100) : 0;
  const reviewPercent = dueToday   > 0 ? Math.round((reviewedToday / dueToday) * 100)   :
                        reviewedToday > 0 ? 100 : 0;

  return (
    <div className="student-progress-panel">
      <div className="progress-item">
        <div className="progress-label-row">
          <span className="progress-label-text">Vocabulary mastered</span>
          <span className="progress-label-count">
            {masteredTerms} / {totalTerms}
          </span>
        </div>
        <ProgressBar percent={termPercent} variant="success" />
        <div className="progress-caption">{termPercent}% of your glossary mastered</div>
      </div>

      <div className="progress-item">
        <div className="progress-label-row">
          <span className="progress-label-text">Flashcards reviewed today</span>
          <span className="progress-label-count">
            {reviewedToday} / {dueToday > 0 ? dueToday : reviewedToday}
          </span>
        </div>
        <ProgressBar percent={reviewPercent} variant="primary" />
        <div className="progress-caption">
          {dueToday > 0
            ? `${reviewPercent}% of today's cards reviewed`
            : reviewedToday > 0
              ? 'All cards reviewed for today!'
              : 'No cards due today'}
        </div>
      </div>

      {totalTerms === 0 && (
        <p className="progress-hint">
          Start by opening a reading and selecting words you do not understand.
        </p>
      )}
    </div>
  );
}

export default StudentProgressPanel;
