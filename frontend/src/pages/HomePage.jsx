import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function HomePage() {
  const { user, profile } = useAuth();

  const dashboardPath =
    profile?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  return (
    <main className="page">
      <div className="home-hero">
        <h1>
          <span>Smart Glossary</span> Assistant
        </h1>
        <p className="hero-subtitle">
          A platform for teacher-guided vocabulary and concept learning through
          curated readings, structured sections, and collaborative folders.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to={dashboardPath}>
              <button type="button" className="hero-cta">
                Go to Dashboard
              </button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <button type="button" className="hero-cta">
                  Get started
                </button>
              </Link>
              <Link to="/login">
                <button type="button" className="hero-cta-secondary">
                  Log in
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="home-divider" />

      <div className="home-features">
        <div className="feature-card">
          <span className="feature-card-icon">📂</span>
          <h3>Organized Folders</h3>
          <p>
            Teachers create folders and sections to structure readings by topic
            or difficulty level.
          </p>
        </div>
        <div className="feature-card">
          <span className="feature-card-icon">📖</span>
          <h3>Curated Readings</h3>
          <p>
            Upload and manage readings within sections. Control visibility so
            students only see what is ready.
          </p>
        </div>
        <div className="feature-card">
          <span className="feature-card-icon">🎓</span>
          <h3>Two Roles</h3>
          <p>
            Teachers manage content and approve students. Students join folders
            and access assigned material.
          </p>
        </div>
        <div className="feature-card">
          <span className="feature-card-icon">🔗</span>
          <h3>Easy Sharing</h3>
          <p>
            Share folders via a unique code or QR code. Students request access
            and teachers approve them.
          </p>
        </div>
      </div>
    </main>
  );
}

export default HomePage;
