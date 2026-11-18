import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Canvas, { type CanvasHandle, type Tool } from "../components/Canvas";
import Toolbar from "../components/Toolbar";
import { useBoard } from "../hooks/useBoard";
import { useHistory } from "../hooks/useHistory";
import { useSocket } from "../hooks/useSocket";

export default function BoardPage() {
  const { id } = useParams();
  const { board, loading, error } = useBoard(id);
  const history = useHistory(id);
  const { connected } = useSocket(id);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  // Each tool remembers its own size, so the eraser can stay wide
  const [sizes, setSizes] = useState({ pen: 4, eraser: 24 });
  const canvasRef = useRef<CanvasHandle>(null);

  if (loading || history.loading) {
    return <div>Loading board...</div>;
  }

  // A drawing that failed to load must not look like an empty board
  if (error || history.error || !board) {
    return (
      <main>
        <p>{error ?? history.error ?? "Board not found"}</p>
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
        {/* Always one line, so a save error never moves the canvas mid-stroke */}
        <p role="status">
          {history.saving
            ? "Saving..."
            : history.saveError
              ? `Not saved: ${history.saveError}. Press Save to try again.`
              : "Saved"}
        </p>
      </header>
      <Toolbar
        tool={tool}
        color={color}
        size={sizes[tool]}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={(size) => setSizes((prev) => ({ ...prev, [tool]: size }))}
        onUndo={() => canvasRef.current?.undo()}
        onClear={() => canvasRef.current?.clear()}
        onSave={() => void history.saveNow()}
      />
      <Canvas
        ref={canvasRef}
        tool={tool}
        color={color}
        size={sizes[tool]}
        initial={history.entries}
        onSave={history.save}
        onRemove={history.remove}
      />
    </main>
  );
}
