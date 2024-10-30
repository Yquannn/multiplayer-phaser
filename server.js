const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static('public'));

let rooms = {}; // Object to keep track of rooms and players

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms[roomId] = { players: {} };
    socket.join(roomId);
    socket.emit('roomJoined', roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      if (Object.keys(rooms[roomId].players).length < 10) {
        socket.join(roomId);
        rooms[roomId].players[socket.id] = { x: 400, y: 300 };

        // Emit the updated players list to all players in the room
        io.to(roomId).emit('currentPlayers', rooms[roomId].players);

        // Notify the newly joined player about their own roomId and the current players
        socket.emit('roomJoined', roomId);
        
        // Notify all players about the updated player count
        io.to(roomId).emit('playerCountUpdated', Object.keys(rooms[roomId].players).length);
      } else {
        socket.emit('playerLimitReached');
      }
    } else {
      socket.emit('roomNotFound', roomId);
    }
  });

  socket.on('playerMoved', (movementData) => {
    const roomId = Array.from(socket.rooms).find(room => rooms[room]);
    if (rooms[roomId] && rooms[roomId].players[socket.id]) {
      // Update player's position based on their movement data
      rooms[roomId].players[socket.id].x = movementData.position.x;
      rooms[roomId].players[socket.id].y = movementData.position.y;

      // Broadcast the updated position of this player to all other players in the room
      socket.to(roomId).emit('playerMoved', {
        playerId: socket.id,
        position: rooms[roomId].players[socket.id],
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Check which room the user was in and remove them
    Object.keys(rooms).forEach(roomId => {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        
        // Emit the updated player list to the remaining players
        io.to(roomId).emit('currentPlayers', rooms[roomId].players);
        
        // Notify all players about the updated player count
        io.to(roomId).emit('playerCountUpdated', Object.keys(rooms[roomId].players).length);
      }
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
