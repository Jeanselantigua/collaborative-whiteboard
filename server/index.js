import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { registerBoardHandlers } from "./sockets/boardHandlers.js";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
  },
});

registerBoardHandlers(io);

const port = process.env.PORT ?? 3001;
httpServer.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
