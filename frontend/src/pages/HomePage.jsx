import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function HomePage() {
  const { user, profile } = useAuth();
  const dashboardPath = profile?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  return (
    <main className="page home-page">

      {/* ── Hero ── */}
      <section className="home-hero-v2">
        <div className="home-hero-content">
          <span className="home-hero-badge">Smart Learning Platform</span>
          <h1 className="home-hero-title">
            Build vocabulary<br />the <span>smart way</span>
          </h1>
          <p className="home-hero-subtitle">
            Teachers create guided readings with curated glossaries. Students
            select words, get instant dictionary definitions, and build a
            personal vocabulary collection — all in one place.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to={dashboardPath}>
                <button type="button" className="hero-cta">Go to Dashboard →</button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <button type="button" className="hero-cta">Get started for free</button>
                </Link>
                <Link to="/login">
                  <button type="button" className="hero-cta-secondary">Log in</button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="home-hero-visual">
          <div className="home-hero-mockup">
            <div className="mockup-header">
              <span className="mockup-dot" />
              <span className="mockup-dot" />
              <span className="mockup-dot" />
              <span className="mockup-header-title">Reading — Unit 1</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-text-block">
                <div className="mockup-line mockup-line-full" />
                <div className="mockup-line mockup-line-3q" />
                <div className="mockup-selected-word">
                  <span className="mockup-word-chip">vocabulary</span>
                </div>
                <div className="mockup-line mockup-line-half" />
                <div className="mockup-line mockup-line-full" />
                <div className="mockup-line mockup-line-2q" />
              </div>
              <div className="mockup-panel">
                <div className="mockup-panel-term">&ldquo;vocabulary&rdquo;</div>
                <div className="mockup-source-badge">Dictionary API</div>
                <div className="mockup-label">Definition</div>
                <div className="mockup-def-line mockup-line-full" />
                <div className="mockup-def-line mockup-line-3q" />
                <div className="mockup-label" style={{ marginTop: '8px' }}>Spanish</div>
                <div className="mockup-translation">vocabulario</div>
                <div className="mockup-add-btn">+ Add to my glossary</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="home-section home-how-it-works">
        <h2 className="home-section-title">How it works</h2>
        <p className="home-section-subtitle">
          Three simple steps from content creation to vocabulary mastery
        </p>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-number">1</div>
            <span className="home-step-icon">📂</span>
            <h3>Teacher creates content</h3>
            <p>
              Organise readings into folders and sections. Add a curated
              glossary so students learn the key terms in context.
            </p>
          </div>
          <div className="home-step-arrow">→</div>
          <div className="home-step">
            <div className="home-step-number">2</div>
            <span className="home-step-icon">📖</span>
            <h3>Students read and select</h3>
            <p>
              Students join via a shared code, read assigned texts, and tap
              any word or phrase for an instant definition.
            </p>
          </div>
          <div className="home-step-arrow">→</div>
          <div className="home-step">
            <div className="home-step-number">3</div>
            <span className="home-step-icon">⭐</span>
            <h3>Build personal vocabulary</h3>
            <p>
              Save words to a personal glossary per reading, track mastered
              terms, and optionally see Spanish translations.
            </p>
          </div>
        </div>
      </section>

      {/* ── Two roles ── */}
      <section className="home-section home-roles">
        <h2 className="home-section-title">Built for two roles</h2>
        <p className="home-section-subtitle">
          Each role has its own dashboard and set of tools
        </p>
        <div className="home-roles-grid">
          <div className="home-role-card home-role-teacher">
            <div className="home-role-icon">🎓</div>
            <h3>For Teachers</h3>
            <ul className="home-role-list">
              <li>Create and organise folders by topic or class</li>
              <li>Publish curated readings with glossary terms</li>
              <li>Control student access and content visibility</li>
              <li>Enable Spanish translations per reading</li>
              <li>Share folders via unique code or QR</li>
            </ul>
          </div>
          <div className="home-role-card home-role-student">
            <div className="home-role-icon">📚</div>
            <h3>For Students</h3>
            <ul className="home-role-list">
              <li>Join folders with an invite code or QR scan</li>
              <li>Read and select any word or phrase</li>
              <li>Get instant dictionary definitions</li>
              <li>Build a personal glossary per reading</li>
              <li>Track which words you have mastered</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Key features ── */}
      <section className="home-section home-features-v2">
        <h2 className="home-section-title">Key features</h2>
        <p className="home-section-subtitle">
          Designed to make vocabulary learning effortless and effective
        </p>
        <div className="home-features-grid">
          <div className="home-feature-item">
            <div className="home-feature-icon-wrap home-feature-icon-blue">
              <span>📖</span>
            </div>
            <div>
              <h4>Instant dictionary lookup</h4>
              <p>
                Select any word to see its definition via the Free Dictionary
                API. Multi-word expressions fall back to Wiktionary automatically.
              </p>
            </div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon-wrap home-feature-icon-green">
              <span>📝</span>
            </div>
            <div>
              <h4>Personal glossary</h4>
              <p>
                Each student builds their own vocabulary list per reading,
                with definitions from the teacher or the dictionary.
              </p>
            </div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon-wrap home-feature-icon-purple">
              <span>🌐</span>
            </div>
            <div>
              <h4>Spanish translation</h4>
              <p>
                Teachers enable on-the-fly Spanish translations per reading.
                Students see them instantly alongside the English definition.
              </p>
            </div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon-wrap home-feature-icon-orange">
              <span>🏆</span>
            </div>
            <div>
              <h4>Mastery tracking</h4>
              <p>
                Students mark words as mastered when they feel confident.
                Visual badges distinguish saved from fully mastered terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA footer ── */}
      {!user && (
        <section className="home-cta-section">
          <h2>Ready to get started?</h2>
          <p>
            Join Smart Glossary Assistant and transform the way vocabulary is
            taught and learned.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link to="/register">
              <button type="button" className="hero-cta">Create a free account</button>
            </Link>
            <Link to="/login">
              <button type="button" className="hero-cta-secondary">Log in</button>
            </Link>
          </div>
        </section>
      )}

    </main>
  );
}

export default HomePage;
