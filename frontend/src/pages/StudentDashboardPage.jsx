import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMyStudentFolders } from "../api/foldersApi";
import { getFolderSections } from "../api/sectionsApi";
import { getSectionReadings } from "../api/readingsApi";
import { getReadingGlossaryTerms } from "../api/glossaryApi";

function StudentDashboardPage() {
  const { profile } = useAuth();
  const [folders, setFolders] = useState([]);
  const [sectionsByFolder, setSectionsByFolder] = useState({});
  const [readingsBySection, setReadingsBySection] = useState({});
  const [glossaryByReading, setGlossaryByReading] = useState({});
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    <main className="page">
      <div className="dashboard-welcome">
        <h2>
          Welcome back, {profile?.first_name} {profile?.last_name}
        </h2>
        <p>Access your folders and assigned readings below.</p>
      </div>

      <h1>Student Dashboard</h1>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <section className="section">
        <div className="folder-list-header">
          <h2>My folders</h2>
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
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            You have not joined any folders yet.
          </p>
        ) : filteredFolders.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            No folders match &quot;{searchTerm}&quot;.
          </p>
        ) : (
          <div className="folder-list">
            {filteredFolders.map((folder) => {
              const sections = sectionsByFolder[folder.folder_id] || [];
              const isExpanded = expandedFolders.has(folder.folder_id);

              return (
                <article key={folder.folder_id} className="folder-row-card">
                  <div className="folder-row-header">
                    <div className="folder-row-info">
                      <h3>{folder.folder_name}</h3>
                      <span className="folder-row-org">
                        {folder.organization_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="folder-expand-btn"
                      onClick={() => toggleFolder(folder.folder_id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Collapse ▲" : "Expand ▼"}
                    </button>
                  </div>

                  {!isExpanded && folder.folder_description && (
                    <p className="folder-row-desc">
                      {folder.folder_description}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="folder-row-body">
                      {folder.folder_description && (
                        <p
                          className="folder-row-desc"
                          style={{ marginTop: 0 }}
                        >
                          {folder.folder_description}
                        </p>
                      )}

                      <div className="student-sections-box">
                        <h4>Sections</h4>

                        {sections.length === 0 ? (
                          <p
                            style={{
                              fontSize: "14px",
                              color: "var(--text-muted)",
                              margin: 0,
                            }}
                          >
                            No sections available yet.
                          </p>
                        ) : (
                          <div className="student-section-list">
                            {sections.map((section) => {
                              const readings =
                                readingsBySection[section.id] || [];

                              return (
                                <div
                                  key={section.id}
                                  className="student-section-card"
                                >
                                  <h5>
                                    {section.order_index}. {section.name}
                                  </h5>

                                  {section.description && (
                                    <p
                                      style={{
                                        fontSize: "13px",
                                        color: "var(--text-muted)",
                                        marginBottom: "10px",
                                      }}
                                    >
                                      {section.description}
                                    </p>
                                  )}

                                  <h6>Readings</h6>

                                  {readings.length === 0 ? (
                                    <p
                                      style={{
                                        fontSize: "13px",
                                        color: "var(--text-light)",
                                        margin: 0,
                                      }}
                                    >
                                      No readings available yet.
                                    </p>
                                  ) : (
                                    <div className="student-reading-list">
                                      {readings.map((reading) => {
                                        const terms =
                                          glossaryByReading[reading.id] || [];

                                        return (
                                          <div
                                            key={reading.id}
                                            className="student-reading-card"
                                          >
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
                                                      <strong>
                                                        {termItem.term}
                                                      </strong>

                                                      <p>{termItem.definition}</p>

                                                      {termItem.example_sentence && (
                                                        <p className="glossary-term-example">
                                                          Example:{" "}
                                                          {termItem.example_sentence}
                                                        </p>
                                                      )}

                                                      {termItem.context_sentence && (
                                                        <p className="glossary-term-context">
                                                          Context:{" "}
                                                          {termItem.context_sentence}
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
    </main>
  );
}

export default StudentDashboardPage;
