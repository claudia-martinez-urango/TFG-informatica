import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../auth/supabaseClient";
import { useAuth } from "../auth/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { fetchProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setErrorMessage("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setErrorMessage("Could not retrieve user information.");
      setLoading(false);
      return;
    }

    const profile = await fetchProfile(userId);

    setLoading(false);

    if (!profile) {
      setErrorMessage("User profile not found.");
      return;
    }

    if (profile.role === "teacher") {
      navigate("/teacher/dashboard");
    } else {
      navigate("/student/dashboard");
    }
  }

  return (
    <main className="page">
      <h1>Login</h1>

      <form onSubmit={handleLogin} className="form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p>
        Forgot your password? <Link to="/forgot-password">Recover it here</Link>
      </p>

      <p>
        Do not have an account? <Link to="/register">Register here</Link>
      </p>

      {errorMessage && <p className="error">{errorMessage}</p>}
    </main>
  );
}

export default LoginPage;