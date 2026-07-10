import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMyStudentFolders }    from '../api/foldersApi';
import { getFolderSections }      from '../api/sectionsApi';
import { getSectionReadings }     from '../api/readingsApi';
import { getReadingGlossaryTerms } from '../api/glossaryApi';
import { getMyFlashcardReminder } from '../api/flashcardsApi';
import {
  getStudentDashboardOverview,
  getStudentRecentReadings,
  getStudentRecentPersonalTerms,
  getStudentLearningRecommendation,
} from '../api/dashboardApi';
import DashboardStatCard         from '../components/dashboard/DashboardStatCard';
import StudentProgressPanel      from '../components/dashboard/StudentProgressPanel';
import StudentRecommendationCard from '../components/dashboard/StudentRecommendationCard';
import StudentAnalyticsPanel     from '../components/dashboard/StudentAnalyticsPanel';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StudentDashboardPage() {
  const { profile, isFirstLogin } = useAuth();

  // ── Existing folder-tree state ───────────────────────────────
  const [folders,          setFolders]          = useState([]);
  const [sectionsByFolder, setSectionsByFolder] = useState({});
  const [readingsBySection, setReadingsBySection] = useState({});
  const [glossaryByReading, setGlossaryByReading] = useState({});
  const [expandedFolders,  setExpandedFolders]  = useState(new Set());
  const [searchTerm,       setSearchTerm]       = useState('');
  const [errorMessage,     setErrorMessage]     = useState('');
  const [flashcardReminder, setFlashcardReminder] = useState(null);

  // ── New dashboard state ──────────────────────────────────────
  const [overview,       setOverview]       = useState(null);
  const [recentReadings, setRecentReadings] = useState([]);
  const [recentTerms,    setRecentTerms]    = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [dashLoading,    setDashLoading]    = useState(true);

  // ── Load folder tree (existing logic, unchanged) ─────────────
  useEffect(() => {
    async function loadFoldersSectionsAndReadings() {
      try {
        const data = await getMyStudentFolders();
        setFolders(data);

        const sectionsMap = {};
        const readingsMap = {};
        const glossaryMap = {};

        for (const folder of data) {
          const sections = await getFolderSections(folder.folder_id);
          sectionsMap[folder.folder_id] = sections;

          for (const section of sections) {
            const readings = await getSectionReadings(section.id);
            readingsMap[section.id] = readings;

            for (const reading of readings) {
              try {
                const terms = await getReadingGlossaryTerms(reading.id);
                glossaryMap[reading.id] = terms;
              } catch {
                glossaryMap[reading.id] = [];
              }
            }
          }
        }

        setSectionsByFolder(sectionsMap);
        setReadingsBySection(readingsMap);
        setGlossaryByReading(glossaryMap);
      } catch (error) {
        setErrorMessage(error.message);
      }
    }

    loadFoldersSectionsAndReadings();

    getMyFlashcardReminder()
      .then(setFlashcardReminder)
      .catch(() => {});
  }, []);

  // ── Load dashboard data (new) ────────────────────────────────
  useEffect(() => {
    async function loadDashboardData() {
      setDashLoading(true);
      try {
        const [overviewData, readingsData, termsData, recommendationData] = await Promise.all([
          getStudentDashboardOverview(),
          getStudentRecentReadings(),
          getStudentRecentPersonalTerms(),
          getStudentLearningRecommendation(),
        ]);
        setOverview(overviewData);
        setRecentReadings(readingsData);
        setRecentTerms(termsData);
        setRecommendation(recommendationData);
      } catch {
        // dashboard stats are non-critical; fail silently
      } finally {
        setDashLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  function toggleFolder(folderId) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  const filteredFolders = folders.filter((f) =>
    f.folder_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="page dashboard-layout">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h2>{isFirstLogin ? 'Welcome' : 'Welcome back'}, {profile?.first_name} {profile?.last_name}</h2>
          <p>Continue learning from your readings, glossary and flashcards.</p>
        </div>
      </div>

      {errorMessage && <p className="error">{errorMessage}</p>}

      {/* ── Flashcard reminder (existing widget) ─────────────── */}
      {flashcardReminder && flashcardReminder.due_count > 0 && (
        <div className="flashcard-reminder" style={{ marginBottom: '24px' }}>
          {flashcardReminder.overdue_count > 0
            ? 'Some vocabulary cards are overdue, but you can review them whenever you are ready.'
            : flashcardReminder.reminder_message}
          {' '}
          <Link
            to="/student/flashcards"
            className="primary-button"
            style={{ display: 'inline-block', marginTop: '8px' }}
          >
            Review now
          </Link>
        </div>
      )}

      {/* ── My folders (moved up so students reach it without scrolling) */}
      <section className="section">
        <div className="folder-list-header">
          <h2>My Folders</h2>
          {folders.length > 0 && (
            <input
              type="search"
              className="folder-search-input"
              placeholder="Search by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          )}
        </div>

        {folders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            You have not joined any folders yet.
          </p>
        ) : filteredFolders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            No folders match &quot;{searchTerm}&quot;.
          </p>
        ) : (
          <div className="folder-list">
            {filteredFolders.map((folder) => {
              const sections  = sectionsByFolder[folder.folder_id] || [];
              const isExpanded = expandedFolders.has(folder.folder_id);

              return (
                <article key={folder.folder_id} className="folder-row-card">
                  <div className="folder-row-header">
                    <div className="folder-row-info">
                      <h3>{folder.folder_name}</h3>
                      <span className="folder-row-org">{folder.organization_name}</span>
                    </div>
                    <button
                      type="button"
                      className="folder-expand-btn"
                      onClick={() => toggleFolder(folder.folder_id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                    </button>
                  </div>

                  {!isExpanded && folder.folder_description && (
                    <p className="folder-row-desc">{folder.folder_description}</p>
                  )}

                  {isExpanded && (
                    <div className="folder-row-body">
                      {folder.folder_description && (
                        <p className="folder-row-desc" style={{ marginTop: 0 }}>
                          {folder.folder_description}
                        </p>
                      )}

                      <div className="student-sections-box">
                        <h4>Sections</h4>

                        {sections.length === 0 ? (
                          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                            No sections available yet.
                          </p>
                        ) : (
                          <div className="student-section-list">
                            {sections.map((section) => {
                              const readings = readingsBySection[section.id] || [];

                              return (
                                <div key={section.id} className="student-section-card">
                                  <h5>{section.order_index}. {section.name}</h5>

                                  {section.description && (
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                      {section.description}
                                    </p>
                                  )}

                                  <h6>Readings</h6>

                                  {readings.length === 0 ? (
                                    <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0 }}>
                                      No readings available yet.
                                    </p>
                                  ) : (
                                    <div className="student-reading-list">
                                      {readings.map((reading) => {
                                        const terms = glossaryByReading[reading.id] || [];

                                        return (
                                          <div key={reading.id} className="student-reading-card">
                                            <h6>{reading.title}</h6>

                                            <p>
                                              {reading.content.length > 180
                                                ? `${reading.content.slice(0, 180)}…`
                                                : reading.content}
                                            </p>

                                            <div className="reading-card-actions">
                                              <Link
                                                to={`/reading/${reading.id}`}
                                                className="reading-open-button"
                                              >
                                                Open reading
                                              </Link>
                                            </div>

                                            <div className="student-glossary-box">
                                              <h6>Glossary</h6>

                                              {terms.length === 0 ? (
                                                <p className="student-glossary-empty">
                                                  No glossary terms available yet.
                                                </p>
                                              ) : (
                                                <div className="student-glossary-term-list">
                                                  {terms.map((termItem) => (
                                                    <div
                                                      key={termItem.id}
                                                      className="student-glossary-term-card"
                                                    >
                                                      <strong>{termItem.term}</strong>
                                                      <p>{termItem.definition}</p>

                                                      {termItem.example_sentence && (
                                                        <p className="glossary-term-example">
                                                          Example: {termItem.example_sentence}
                                                        </p>
                                                      )}

                                                      {termItem.context_sentence && (
                                                        <p className="glossary-term-context">
                                                          Context: {termItem.context_sentence}
                                                        </p>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Stats grid ───────────────────────────────────────── */}
      {!dashLoading && overview && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">My Learning Overview</h2>
          <div className="dashboard-stats-grid">
            <DashboardStatCard label="My Folders"         value={overview.my_folders_count}         />
            <DashboardStatCard label="Available Readings" value={overview.available_readings_count}  />
            <DashboardStatCard label="My Glossary Terms"  value={overview.personal_terms_count}      />
            <DashboardStatCard label="Mastered Terms"     value={overview.mastered_terms_count}      variant="success" />
            <DashboardStatCard label="To Master"          value={overview.not_mastered_terms_count}  variant={overview.not_mastered_terms_count > 0 ? 'warning' : undefined} />
            <DashboardStatCard
              label="Flashcards Due Today"
              value={overview.due_flashcards_count}
              variant={overview.due_flashcards_count > 0 ? 'warning' : undefined}
            />
            <DashboardStatCard label="Upcoming Flashcards" value={overview.upcoming_flashcards_count} />
            <DashboardStatCard label="Reviewed Today"     value={overview.reviewed_today_count}      variant="success" />
            <DashboardStatCard label="Bloom Activities"   value={overview.bloom_answers_count}       />
          </div>
        </section>
      )}

      {/* ── Recommendation ───────────────────────────────────── */}
      {!dashLoading && recommendation && (
        <section className="dashboard-section">
          <StudentRecommendationCard recommendation={recommendation} />
        </section>
      )}

      {/* ── Progress ─────────────────────────────────────────── */}
      {!dashLoading && overview && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">My Progress</h2>
          <StudentProgressPanel
            totalTerms={overview.personal_terms_count}
            masteredTerms={overview.mastered_terms_count}
            reviewedToday={overview.reviewed_today_count}
            dueToday={overview.due_flashcards_count + overview.reviewed_today_count}
          />
        </section>
      )}

      {/* ── Continue learning ────────────────────────────────── */}
      {!dashLoading && (recentReadings.length > 0 || recentTerms.length > 0) && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Continue Learning</h2>
          <div className="continue-learning-grid">

            {/* Recent readings */}
            {recentReadings.length > 0 && (
              <div className="continue-learning-block">
                <h3 className="continue-learning-subtitle">Recent Readings</h3>
                <div className="continue-learning-list">
                  {recentReadings.map((reading) => (
                    <div key={reading.reading_id} className="continue-learning-item">
                      <div className="continue-learning-item-info">
                        <span className="continue-learning-item-title">
                          {reading.reading_title}
                        </span>
                        <span className="continue-learning-item-meta">
                          {reading.folder_name} › {reading.section_name}
                        </span>
                      </div>
                      <Link
                        to={`/reading/${reading.reading_id}`}
                        className="continue-learning-btn"
                      >
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent personal terms */}
            {recentTerms.length > 0 && (
              <div className="continue-learning-block">
                <h3 className="continue-learning-subtitle">Recently Added Terms</h3>
                <div className="continue-learning-list">
                  {recentTerms.map((term) => (
                    <div key={term.term_id} className="continue-learning-item">
                      <div className="continue-learning-item-info">
                        <span className="continue-learning-item-title">
                          {term.selected_text}
                        </span>
                        <span className="continue-learning-item-meta">
                          {term.reading_title} · {formatDate(term.created_at)}
                          {term.is_mastered && (
                            <span className="badge badge--success" style={{ marginLeft: '6px' }}>
                              Mastered
                            </span>
                          )}
                        </span>
                      </div>
                      <Link
                        to={`/reading/${term.reading_id}`}
                        className="continue-learning-btn"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── My analytics ─────────────────────────────────────── */}
      {!dashLoading && overview && overview.personal_terms_count > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">My Learning Analytics</h2>
          <p className="analytics-caption" style={{ marginBottom: '16px' }}>
            Track which folders you have mastered and which need more practice.
          </p>
          <StudentAnalyticsPanel />
        </section>
      )}
    </main>
  );
}

export default StudentDashboardPage;
