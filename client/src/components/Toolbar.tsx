import type { Tool } from "./Canvas";

type Props = {
  tool: Tool;
  color: string;
  size: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onSave: () => void;
};

export default function Toolbar({
  tool,
  color,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
  onSave,
}: Props) {
  return (
    <div role="toolbar" aria-label="Drawing tools">
      <label>
        <input
          type="radio"
          name="tool"
          checked={tool === "pen"}
          onChange={() => onToolChange("pen")}
        />
        Pen
      </label>
      <label>
        <input
          type="radio"
          name="tool"
          checked={tool === "eraser"}
          onChange={() => onToolChange("eraser")}
        />
        Eraser
      </label>
      <label>
        Color
        <input
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </label>
      <label>
        Size
        <input
          type="range"
          min={1}
          max={40}
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value))}
        />
      </label>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
      <button type="button" onClick={onClear}>
        Clear
      </button>
      <button type="button" onClick={onSave}>
        Save
      </button>
    </div>
  );
}
