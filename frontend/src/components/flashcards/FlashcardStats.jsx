function StatCard({ label, value, highlight }) {
  return (
    <div className={`flashcard-stat-card${highlight ? ' flashcard-stat-card--highlight' : ''}`}>
      <span className="flashcard-stat-value">{value}</span>
      <span className="flashcard-stat-label">{label}</span>
    </div>
  );
}

function FlashcardStats({ overview }) {
  if (!overview) return null;

  return (
    <div className="flashcard-stats-grid">
      <StatCard label="Due today"      value={overview.due_today_count}      highlight={overview.due_today_count > 0} />
      <StatCard label="Overdue"        value={overview.overdue_count}        highlight={overview.overdue_count > 0} />
      <StatCard label="Reviewed today" value={overview.reviewed_today_count} />
      <StatCard label="Upcoming"       value={overview.upcoming_count} />
      <StatCard label="Mastered"       value={overview.mastered_count} />
      <StatCard label="Total cards"    value={overview.total_cards} />
    </div>
  );
}

export default FlashcardStats;
