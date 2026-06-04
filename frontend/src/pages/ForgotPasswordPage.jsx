import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../auth/supabaseClient";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordReset(event) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:5173/update-password",
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password recovery email sent. Please check your inbox.");
    setEmail("");
    setLoading(false);
  }

  return (
    <main className="page">
      <h1>Recover password</h1>

      <p>
        Enter your email address and you will receive a password recovery link.
      </p>

      <form onSubmit={handlePasswordReset} className="form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send recovery email"}
        </button>
      </form>

      <p>
        Remembered your password? <Link to="/login">Back to login</Link>
      </p>

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
    </main>
  );
}

export default ForgotPasswordPage;