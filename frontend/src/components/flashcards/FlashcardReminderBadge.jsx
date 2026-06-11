import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyFlashcardReminder } from '../../api/flashcardsApi';

function FlashcardReminderBadge() {
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    getMyFlashcardReminder()
      .then(setReminder)
      .catch(() => {
        // Silently fail — badge is non-critical
        setReminder({ due_count: 0, overdue_count: 0, reminder_message: 'Flashcards' });
      });
  }, []);

  const dueCount     = reminder?.due_count     ?? 0;
  const overdueCount = reminder?.overdue_count ?? 0;

  return (
    <Link to="/student/flashcards" className="flashcard-navbar-link">
      Flashcards
      {dueCount > 0 && (
        <span className={`flashcard-reminder-badge ${overdueCount > 0 ? 'flashcard-reminder-badge--overdue' : ''}`}>
          {dueCount}
        </span>
      )}
    </Link>
  );
}

export default FlashcardReminderBadge;
