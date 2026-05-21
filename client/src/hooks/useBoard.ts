import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Board = {
  id: string;
  name: string;
  createdAt: string;
};

export function useBoard(boardId?: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("Board")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setBoards(data ?? []);
    }

    setLoading(false);
  }, []);

  const fetchBoard = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("Board")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setError(error.message);
      setBoard(null);
    } else {
      setBoard(data);
    }

    setLoading(false);
  }, []);

  const createBoard = useCallback(async (name: string) => {
    const { data, error } = await supabase
      .from("Board")
      .insert({ name })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Board;
  }, []);

  useEffect(() => {
    if (boardId) {
      void fetchBoard(boardId);
      return;
    }

    void fetchBoards();
  }, [boardId, fetchBoard, fetchBoards]);

  return {
    board,
    boards,
    loading,
    error,
    fetchBoards,
    fetchBoard,
    createBoard,
  };
}
