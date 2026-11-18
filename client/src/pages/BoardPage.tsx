import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Canvas, { type CanvasHandle, type Tool } from "../components/Canvas";
import Toolbar from "../components/Toolbar";
import { useBoard } from "../hooks/useBoard";
import { useSocket } from "../hooks/useSocket";

export default function BoardPage() {
  const { id } = useParams();
  const { board, loading, error } = useBoard(id);
  const { connected } = useSocket(id);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  // Each tool remembers its own size, so the eraser can stay wide
  const [sizes, setSizes] = useState({ pen: 4, eraser: 24 });
  const canvasRef = useRef<CanvasHandle>(null);

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
      <Toolbar
        tool={tool}
        color={color}
        size={sizes[tool]}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={(size) => setSizes((prev) => ({ ...prev, [tool]: size }))}
        onUndo={() => canvasRef.current?.undo()}
        onClear={() => canvasRef.current?.clear()}
      />
      <Canvas ref={canvasRef} tool={tool} color={color} size={sizes[tool]} />
    </main>
  );
}
