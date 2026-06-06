import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <h2>Smart Glossary Assistant</h2>

      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <Link to="/student/dashboard">Student</Link>
        <Link to="/teacher/dashboard">Teacher</Link>
      </div>
    </nav>
  );
}

export default Navbar;