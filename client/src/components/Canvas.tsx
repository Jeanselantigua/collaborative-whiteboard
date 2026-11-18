import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent,
} from "react";

export type Tool = "pen" | "eraser";

type Point = { x: number; y: number };

export type Stroke = {
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
};

// "clear" sits in the same list as strokes, so undo can take it back too
export type Entry = Stroke | "clear";

// An entry plus the id of its row in the database. The id is made here, not
// by the database, so undo can name the row without waiting for the save.
export type Saved<T extends Entry = Entry> = { id: string; data: T };

export type CanvasHandle = {
  undo: () => void;
  clear: () => void;
};

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Draws the part of a stroke that point index `from` added, up to its end.
// Curves run between the midpoints of neighbouring points, bending toward
// the point in between, which rounds off the corners of raw pointer input.
// `finished` adds the last half-segment, from the final midpoint to the end.
function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  from = 0,
  finished = true,
) {
  const { points } = stroke;
  // "destination-out" removes pixels instead of painting them
  ctx.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const start = from <= 1 ? points[0] : mid(points[from - 2], points[from - 1]);
  ctx.moveTo(start.x, start.y);
  for (let i = Math.max(from, 1); i < points.length; i++) {
    const end = mid(points[i - 1], points[i]);
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, end.x, end.y);
  }
  if (finished) {
    // For a single point this is a zero-length line, which leaves a dot
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

// Rebuilds the picture from the list. Needed whenever pixels are lost or stale.
function redraw(canvas: HTMLCanvasElement, history: Saved[]) {
  const ctx = canvas.getContext("2d")!;
  // +1 covers rounding when the screen's pixel ratio is fractional
  const wipe = () =>
    ctx.clearRect(0, 0, canvas.clientWidth + 1, canvas.clientHeight + 1);

  wipe();
  for (const { data } of history) {
    if (data === "clear") {
      wipe();
    } else {
      drawStroke(ctx, data);
    }
  }
}

type Props = {
  tool: Tool;
  color: string;
  size: number;
  // The saved drawing to start from. Read once, when the canvas appears.
  initial: Saved[];
  onSave: (entry: Saved) => void;
  onRemove: (id: string) => void;
};

const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { tool, color, size, initial, onSave, onRemove },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Refs, not state: a pointer move must not re-render React
  const historyRef = useRef<Saved[]>([...initial]);
  const currentRef = useRef<Saved<Stroke> | null>(null);

  // Lets the parent call undo() and clear() from toolbar buttons
  useImperativeHandle(
    ref,
    () => ({
      undo() {
        currentRef.current = null;
        const removed = historyRef.current.pop();
        if (!removed) return;
        redraw(canvasRef.current!, historyRef.current);
        onRemove(removed.id);
      },
      clear() {
        const history = historyRef.current;
        const last = history[history.length - 1];
        // Nothing to clear, so don't add an entry that undo would have to eat
        if (!last || last.data === "clear") return;

        currentRef.current = null;
        const entry: Saved = { id: crypto.randomUUID(), data: "clear" };
        history.push(entry);
        redraw(canvasRef.current!, history);
        onSave(entry);
      },
    }),
    [onSave, onRemove],
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      // Setting width/height wipes the canvas, so replay the list after
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.scale(dpr, dpr);
      redraw(canvas, historyRef.current);
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    // Keep receiving moves even if the pointer leaves the canvas mid-stroke
    event.currentTarget.setPointerCapture(event.pointerId);

    const stroke: Stroke = {
      tool,
      color,
      size,
      points: [{ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }],
    };
    const entry = { id: crypto.randomUUID(), data: stroke };
    historyRef.current.push(entry);
    currentRef.current = entry;
    drawStroke(event.currentTarget.getContext("2d")!, stroke);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current?.data;
    if (!stroke || !event.isPrimary) return;

    stroke.points.push({
      x: event.nativeEvent.offsetX,
      y: event.nativeEvent.offsetY,
    });
    // Draw only the newest curve, not the whole stroke again. It stops at the
    // last midpoint, because the next point decides how the rest bends.
    drawStroke(
      event.currentTarget.getContext("2d")!,
      stroke,
      stroke.points.length - 1,
      false,
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const entry = currentRef.current;
    if (!entry || !event.isPrimary) return;

    currentRef.current = null;
    // Only the last half-segment is still missing
    drawStroke(
      event.currentTarget.getContext("2d")!,
      entry.data,
      entry.data.points.length,
    );
    // Saved once, when the stroke is finished, not on every point
    onSave(entry);
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // shortcut: inline placeholder styles, replace in the styling step
      style={{
        display: "block",
        width: "100%",
        height: "75vh",
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "crosshair",
        // Stops touch drags from scrolling the page instead of drawing
        touchAction: "none",
      }}
    />
  );
});

export default Canvas;
