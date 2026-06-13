import { Link } from 'react-router-dom';

const TYPE_VARIANT = {
  review_flashcards:  'primary',
  start_glossary:     'info',
  practice_vocabulary: 'warning',
  all_done:           'success',
};

function StudentRecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const variant = TYPE_VARIANT[recommendation.recommendation_type] || 'primary';

  return (
    <div className={`recommendation-card recommendation-card--${variant}`}>
      <div className="recommendation-content">
        <h3 className="recommendation-title">{recommendation.recommendation_title}</h3>
        <p className="recommendation-message">{recommendation.recommendation_message}</p>
      </div>
      <Link to={recommendation.action_url} className="recommendation-action">
        {recommendation.action_label}
      </Link>
    </div>
  );
}

export default StudentRecommendationCard;
