const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

io.on('connection', socket => {
  socket.on('room:join', ({ email, room }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push({ id: socket.id, email });
    io.to(room).emit('room-users', rooms[room]);
  });

  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', { from: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('leave-room', ({ room }) => {
    socket.leave(room);
    if (rooms[room]) {
      rooms[room] = rooms[room].filter(u => u.id !== socket.id);
      io.to(room).emit('room-users', rooms[room]);
    }
  });

  socket.on('disconnect', () => {
    for (let r in rooms) {
      rooms[r] = rooms[r].filter(u => u.id !== socket.id);
      io.to(r).emit('room-users', rooms[r]);
    }
  });
});

server.listen(8000, () => console.log('Server running on port 8000'));