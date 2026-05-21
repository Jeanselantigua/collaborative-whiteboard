export function registerBoardHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("board:join", (boardId) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("board:leave", (boardId) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on("board:stroke", ({ boardId, stroke }) => {
      socket.to(`board:${boardId}`).emit("board:stroke", stroke);
    });
  });
}
