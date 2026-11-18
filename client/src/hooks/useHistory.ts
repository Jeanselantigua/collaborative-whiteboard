import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry, Saved, Stroke } from "../components/Canvas";
import { supabase } from "../lib/supabase";

// Supabase returns at most 1000 rows per request, so a long history is
// fetched in pages of this size
const PAGE = 1000;

// One change to send to the database: an insert or a delete
type Write = () => PromiseLike<{
  error: { message: string; code?: string } | null;
}>;

// True if `data` has everything the canvas reads without checking. A bad
// color or size is harmless: the canvas ignores values it cannot use.
function isEntry(data: unknown): data is Entry {
  if (data === "clear") return true;
  const points: unknown = (data as Stroke | null)?.points;
  return (
    Array.isArray(points) &&
    points.length > 0 &&
    points.every(
      (point) => typeof point?.x === "number" && typeof point?.y === "number",
    )
  );
}

// Loads a board's saved drawing, and saves the changes made to it
export function useHistory(boardId?: string) {
  const [entries, setEntries] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Changes not yet in the database, oldest first
  const pendingRef = useRef<Write[]>([]);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!boardId) return;
    // Set when the page moves on, so a late answer is ignored
    let stale = false;

    async function load(id: string) {
      const rows: Saved[] = [];
      for (;;) {
        const { data, error } = await supabase
          .from("Stroke")
          .select("id, data")
          .eq("boardId", id)
          .order("seq")
          .range(rows.length, rows.length + PAGE - 1);
        if (stale) return;
        if (error) {
          setError(error.message);
          break;
        }
        rows.push(...data);
        if (data.length < PAGE) {
          // Anyone with the public key can write rows, so drop any that
          // are not a drawable entry instead of crashing on them
          setEntries(rows.filter((row) => isEntry(row.data)));
          break;
        }
      }
      setLoading(false);
    }

    void load(boardId);
    return () => {
      stale = true;
    };
  }, [boardId]);

  // Sends the waiting changes one at a time, oldest first. Sent side by side,
  // an undo could reach the database before the stroke it removes. A change
  // that fails stays at the front, so nothing overtakes it, and the next
  // call tries it again.
  // shortcut: a failed change is retried only on the next change or a click
  // on Save. Retry on a timer if users report losing work while offline.
  const saveNow = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSaving(true);

    const pending = pendingRef.current;
    let failure: string | null = null;
    while (pending.length > 0) {
      const { error } = await pending[0]();
      // 23505 means the row already exists: an earlier try did save it, and
      // only its answer was lost
      if (error && error.code !== "23505") {
        failure = error.message;
        break;
      }
      pending.shift();
    }

    setSaveError(failure);
    setSaving(false);
    sendingRef.current = false;
  }, []);

  const write = useCallback(
    (send: Write) => {
      pendingRef.current.push(send);
      void saveNow();
    },
    [saveNow],
  );

  const save = useCallback(
    (entry: Saved) =>
      write(() => supabase.from("Stroke").insert({ ...entry, boardId })),
    [boardId, write],
  );

  const remove = useCallback(
    (id: string) => write(() => supabase.from("Stroke").delete().eq("id", id)),
    [write],
  );

  return { entries, loading, error, saving, saveError, save, remove, saveNow };
}
