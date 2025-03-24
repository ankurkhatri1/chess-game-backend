const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://chess-game-frontend-pi.vercel.app',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

let players = [];
let currentTurn = 'white';
let game = new Chess();

io.on('connection', (socket) => {
  console.log('EK AUR LADAI-BAZ CONNECT HO GAYA!', socket.id);

  if (players.length === 0) {
    players.push({ id: socket.id, role: 'initiator', color: 'white' });
    socket.emit('role', { role: 'initiator', color: 'white' });
  } else if (players.length === 1) {
    players.push({ id: socket.id, role: 'receiver', color: 'black' });
    socket.emit('role', { role: 'receiver', color: 'black' });
    io.emit('start', { turn: currentTurn, fen: game.fen() });
  } else {
    socket.emit('error', 'DO SE ZYADA PLAYERS NAHI!');
    socket.disconnect();
    return;
  }

  socket.on('move', (moveSan) => {
    const player = players.find((p) => p.id === socket.id);
    if (player.color !== currentTurn) {
      socket.emit('error', 'TERI BAARI NAHI HAI, BHAI!');
      return;
    }

    const move = game.move(moveSan);
    if (!move) {
      socket.emit('error', 'GALAT CHAL, BHAI!');
      return;
    }

    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    io.emit('move', { san: moveSan, fen: game.fen() });
    io.emit('turn', currentTurn);
  });

  socket.on('peer-id', ({ peerId, role }) => {
    console.log(`Received Peer ID from ${role}: ${peerId}`);
    socket.broadcast.emit('peer-id', { peerId, role });
  });

  socket.on('disconnect', () => {
    console.log('EK LADAI-BAZ BHAG GAYA!', socket.id);
    players = players.filter((player) => player.id !== socket.id);
    currentTurn = 'white';
    game = new Chess();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SERVER CHALU HAI, ${PORT} PE LADAI KE LIYE TAYYAR!`);
});