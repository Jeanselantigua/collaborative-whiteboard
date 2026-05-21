import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const action = isSignUp ? signUpWithEmail : signInWithEmail;
    const { error } = await action(email, password);

    if (error) {
      setError(error.message);
    }

    setSubmitting(false);
  }

  return (
    <main>
      <h1>{isSignUp ? "Sign up" : "Login"}</h1>
      <form onSubmit={handleSubmit}>
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
        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>
      {error && <p>{error}</p>}
      <button type="button" onClick={() => setIsSignUp((value) => !value)}>
        {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>
      <p>
        <Link to="/">Back to dashboard</Link>
      </p>
    </main>
  );
}
