const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ==== VETËM KËTA 2 PËRDORUES LEJOHEN ====
const ALLOWED_USERS = {
  AAA: '111111',
  MMM: '111111'
};
// =========================================

const users = new Map(); // socket.id -> username

io.on('connection', (socket) => {
  socket.on('join', ({ username, password }) => {
    username = (username || '').trim().toUpperCase();

    if (!ALLOWED_USERS[username]) {
      return socket.emit('join-error', 'Ky emër nuk ekziston. Provo AAA ose MMM.');
    }
    if (ALLOWED_USERS[username] !== password) {
      return socket.emit('join-error', 'Fjalëkalim i gabuar.');
    }

    // Nëse i njëjti emër është i lidhur, shkëpute atë të vjetrin (rifreskim)
    for (const [id, name] of users) {
      if (name === username) {
        const old = io.sockets.sockets.get(id);
        if (old) {
          old.emit('kicked', 'U logove nga një dritare tjetër');
          old.disconnect();
        }
      }
    }

    users.set(socket.id, username);
    socket.username = username;
    socket.emit('joined', username);
    io.emit('users', [...users.values()]);
  });

  socket.on('chat', ({ to, text, image }) => {
    if (!socket.username) return;
    const msg = { from: socket.username, to, text, image, time: Date.now() };
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('chat', msg);
    socket.emit('chat', msg);
  });

  socket.on('typing', ({ to, isTyping }) => {
    if (!socket.username) return;
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('typing', { from: socket.username, isTyping });
  });

  // WebRTC signaling
  socket.on('call-offer', ({ to, offer, video }) => {
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('call-offer', { from: socket.username, offer, video });
  });
  socket.on('call-answer', ({ to, answer }) => {
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('call-answer', { answer });
  });
  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('ice-candidate', { candidate });
  });
  socket.on('call-end', ({ to }) => {
    const targetId = findSocketId(to);
    if (targetId) io.to(targetId).emit('call-end');
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.id);
      io.emit('users', [...users.values()]);
    }
  });
});

function findSocketId(username) {
  for (const [id, name] of users) {
    if (name === username) return id;
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serveri në portin ' + PORT));
