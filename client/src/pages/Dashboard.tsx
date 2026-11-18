import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useBoard } from "../hooks/useBoard";

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { boards, loading, error, createBoard } = useBoard();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateBoard(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreateError(null);
    try {
      const board = await createBoard(trimmed);
      window.location.assign(`/board/${board.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create board",
      );
    }
  }

  if (authLoading || loading) {
    return <div>Loading...</div>;
  }

  return (
    <main>
      <header>
        <h1>Dashboard</h1>
        {user ? (
          <p>
            Signed in as {user.email}{" "}
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </p>
        ) : (
          <p>
            <Link to="/login">Sign in</Link>
          </p>
        )}
      </header>

      <form onSubmit={handleCreateBoard}>
        <label>
          Board name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <button type="submit">New board</button>
      </form>

      {createError && <p role="alert">{createError}</p>}
      {error && <p>{error}</p>}

      <ul>
        {boards.map((board) => (
          <li key={board.id}>
            <Link to={`/board/${board.id}`}>{board.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
