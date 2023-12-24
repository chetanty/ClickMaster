const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const rooms = {};

io.on('connection', (socket) => {
  socket.on('createRoom', (roomName, playerName) => {
    const room = {
      name: roomName,
      players: [{ id: socket.id, name: playerName, clicks: 0, ready: false }],
    };
    rooms[roomName] = room;
    socket.join(roomName);
    io.to(roomName).emit('updatePlayers', room.players);
  });

  socket.on('joinRoom', (roomName, playerName) => {
    if (!rooms[roomName]) {
      socket.emit('errorMessage', 'Room does not exist');
      return;
    }

    const room = rooms[roomName];
    room.players.push({ id: socket.id, name: playerName, clicks: 0, ready: false });
    socket.join(roomName);
    io.to(roomName).emit('updatePlayers', room.players);
  });

  socket.on('ready', (roomName) => {
    const room = rooms[roomName];
    const player = room.players.find((p) => p.id === socket.id);

    if (player) {
      player.ready = true;
      io.to(roomName).emit('playerReady', player.name);

      if (room.players.every((p) => p.ready)) {
        io.to(roomName).emit('startGame');

        const gameDuration = 10000; // 10 seconds
        let clicks = 0;

        const interval = setInterval(() => {
          room.players.forEach((p) => {
            p.clicks += clicks; // Accumulate clicks for each player
          });
          io.to(roomName).emit('updatePlayers', room.players);
          clicks = 0; // Reset clicks for the next interval
        }, 1000);

        setTimeout(() => {
          clearInterval(interval);

          const scores = room.players.map((player) => ({
            name: player.name,
            clicks: player.clicks,
          }));

          io.to(roomName).emit('gameOver', scores);

          // Reset room data for a new game
          delete rooms[roomName];
        }, gameDuration);
      }
    }
  });

  socket.on('click', (roomName) => {
    const room = rooms[roomName];
    const player = room.players.find((p) => p.id === socket.id);

    if (player && player.ready) {
      player.clicks += 1;
      io.to(roomName).emit('updatePlayers', room.players);
    }
  });

  socket.on('disconnect', () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      const index = room.players.findIndex((p) => p.id === socket.id);

      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomName).emit('updatePlayers', room.players);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
