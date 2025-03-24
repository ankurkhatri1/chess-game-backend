const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://chess-game-frontend-pi.vercel.app', // Vercel frontend URL
      'http://localhost:5173', // Localhost for development
    ],
    methods: ['GET', 'POST'],
    credentials: true, // Allow credentials for WebSocket
  },
  path: '/socket.io', // Ensure correct path for production
});

app.use(cors({
  origin: [
    'https://chess-game-frontend-pi.vercel.app',
    'http://localhost:5173',
  ],
  credentials: true,
}));

const challenges = new Map();

io.on('connection', (socket) => {
  console.log('EK AUR LADAI-BAZ CONNECT HO GAYA!', socket.id);

  socket.on('create-challenge', (challengeId) => {
    if (!challengeId) {
      socket.emit('error', 'Challenge ID is required!');
      return;
    }

    if (challenges.has(challengeId)) {
      socket.emit('error', 'Challenge ID already exists!');
      return;
    }

    challenges.set(challengeId, {
      players: [{ id: socket.id, role: 'initiator', color: 'white' }],
      game: new Chess(),
      currentTurn: 'white',
    });

    socket.emit('role', { role: 'initiator', color: 'white' });
    console.log(`Challenge created: ${challengeId}, Initiator: ${socket.id}, Role emitted`);
  });

  socket.on('join-challenge', (challengeId) => {
    console.log(`Join request for challenge: ${challengeId}, Socket: ${socket.id}`);
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      socket.emit('error', 'Challenge not found!');
      socket.disconnect();
      console.log(`Challenge not found: ${challengeId}`);
      return;
    }

    if (challenge.players.length >= 2) {
      socket.emit('error', 'Game is already in progress! You cannot join.');
      socket.disconnect();
      console.log(`Challenge ${challengeId} is full`);
      return;
    }

    challenge.players.push({ id: socket.id, role: 'receiver', color: 'black' });
    socket.emit('role', { role: 'receiver', color: 'black' });
    io.to(challenge.players[0].id).emit('start', { turn: challenge.currentTurn, fen: challenge.game.fen() });
    socket.emit('start', { turn: challenge.currentTurn, fen: challenge.game.fen() });
    console.log(`Player joined challenge: ${challengeId}, Receiver: ${socket.id}, Start emitted`);
  });

  socket.on('move', ({ san, challengeId }) => {
    console.log(`Move received for challenge: ${challengeId}, Move: ${san}`);
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      socket.emit('error', 'Challenge not found!');
      console.log(`Challenge not found for move: ${challengeId}`);
      return;
    }

    const player = challenge.players.find((p) => p.id === socket.id);
    if (player.color !== challenge.currentTurn) {
      socket.emit('error', 'TERI BAARI NAHI HAI, BHAI!');
      console.log(`Not your turn: ${socket.id}`);
      return;
    }

    const move = challenge.game.move(san);
    if (!move) {
      socket.emit('error', 'GALAT CHAL, BHAI!');
      console.log(`Invalid move: ${san}`);
      return;
    }

    challenge.currentTurn = challenge.currentTurn === 'white' ? 'black' : 'white';
    challenge.players.forEach((p) => {
      io.to(p.id).emit('move', { san, fen: challenge.game.fen() });
      io.to(p.id).emit('turn', challenge.currentTurn);
    });
    console.log(`Move processed for challenge: ${challengeId}, New turn: ${challenge.currentTurn}`);
  });

  socket.on('signal', ({ data, to, challengeId }) => {
    console.log(`Signal for challenge: ${challengeId}, From: ${socket.id}, To: ${to}`);
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      socket.emit('error', 'Challenge not found!');
      console.log(`Challenge not found for signal: ${challengeId}`);
      return;
    }

    const targetPlayer = challenge.players.find((p) => p.role === to);
    if (targetPlayer) {
      io.to(targetPlayer.id).emit('signal', { data, from: socket.id });
      console.log(`Signal sent to ${targetPlayer.id}`);
    } else {
      console.error('Target player not found:', to);
    }
  });

  socket.on('disconnect', () => {
    console.log('EK LADAI-BAZ BHAG GAYA!', socket.id);
    for (const [challengeId, challenge] of challenges.entries()) {
      const playerIndex = challenge.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        challenges.delete(challengeId);
        challenge.players.forEach((p) => {
          if (p.id !== socket.id) {
            io.to(p.id).emit('error', 'Opponent disconnected! Game ended.');
          }
        });
        console.log(`Challenge ${challengeId} deleted due to disconnection`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SERVER CHALU HAI, ${PORT} PE LADAI KE LIYE TAYYAR!`);
});