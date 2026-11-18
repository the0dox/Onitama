import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const CLIENT = "http://localhost:5173";
const app = express();
app.use(cors({ origin: CLIENT }));
app.get("/health", (req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT } });

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("hello", (name) => {
    io.emit("message", `${name} says hi`); // broadcast to everyone
  });

  socket.on("disconnect", () => console.log("disconnected:", socket.id));
});

httpServer.listen(3001, () => console.log("Server on :3001"))
