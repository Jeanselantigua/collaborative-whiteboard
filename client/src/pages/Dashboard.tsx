import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useBoard } from "../hooks/useBoard";

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { boards, loading, error, createBoard } = useBoard();

  async function handleCreateBoard() {
    const name = window.prompt("Board name");
    if (!name) return;

    const board = await createBoard(name);
    window.location.assign(`/board/${board.id}`);
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

      <button type="button" onClick={() => void handleCreateBoard()}>
        New board
      </button>

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
