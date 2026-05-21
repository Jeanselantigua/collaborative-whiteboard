import { Link, useParams } from "react-router-dom";
import { useBoard } from "../hooks/useBoard";
import { useSocket } from "../hooks/useSocket";

export default function BoardPage() {
  const { id } = useParams();
  const { board, loading, error } = useBoard(id);
  const { connected } = useSocket(id);

  if (loading) {
    return <div>Loading board...</div>;
  }

  if (error || !board) {
    return (
      <main>
        <p>{error ?? "Board not found"}</p>
        <Link to="/">Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main>
      <header>
        <Link to="/">Dashboard</Link>
        <h1>{board.name}</h1>
        <p>{connected ? "Connected" : "Connecting..."}</p>
      </header>
      <div>Board canvas goes here</div>
    </main>
  );
}
