import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../auth/supabaseClient";

function UpdatePasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRules = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
    };
  }, [password]);

  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  async function handleUpdatePassword(event) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!isPasswordValid) {
      setErrorMessage("Password does not meet the required security rules.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. You can now log in.");
    setPassword("");
    setLoading(false);

    setTimeout(() => {
      navigate("/login");
    }, 1500);
  }

  return (
    <main className="page">
      <h1>Update password</h1>

      <form onSubmit={handleUpdatePassword} className="form">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <div className="password-rules">
          <p>Password must contain:</p>
          <ul>
            <li className={passwordRules.length ? "valid-rule" : "invalid-rule"}>
              At least 8 characters
            </li>
            <li className={passwordRules.uppercase ? "valid-rule" : "invalid-rule"}>
              One uppercase letter
            </li>
            <li className={passwordRules.lowercase ? "valid-rule" : "invalid-rule"}>
              One lowercase letter
            </li>
            <li className={passwordRules.number ? "valid-rule" : "invalid-rule"}>
              One number
            </li>
            <li className={passwordRules.symbol ? "valid-rule" : "invalid-rule"}>
              One symbol
            </li>
          </ul>
        </div>

        <button type="submit" disabled={loading || !isPasswordValid}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p>
        Go back to <Link to="/login">Login</Link>
      </p>

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
    </main>
  );
}

export default UpdatePasswordPage;