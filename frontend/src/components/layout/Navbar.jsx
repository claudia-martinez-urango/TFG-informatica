import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function Navbar() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <h2>Smart Glossary Assistant</h2>

      <div className="navbar-links">
        <Link to="/">Home</Link>

        {!user && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}

        {user && profile?.role === "student" && (
          <>
            <Link to="/student/dashboard">Student Dashboard</Link>
            <Link to="/join">Join Folder</Link>
          </>
        )}

        {user && profile?.role === "teacher" && (
          <>
            <Link to="/teacher/dashboard">Teacher Dashboard</Link>
            <Link to="/teacher/folders">Folders</Link>
          </>
        )}

        {user && profile && (
          <span className="navbar-user">
            {profile.first_name} {profile.last_name} ({profile.role})
          </span>
        )}

        {user && (
          <button type="button" className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;