const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    // Start player in a random spot
    players[socket.id] = { 
        x: Math.random() * 500, 
        y: Math.random() * 500, 
        color: `hsl(${Math.random() * 360}, 70%, 50%)` 
    };

    io.emit('updatePlayers', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            // "Volatile" emit is faster for high-frequency updates like movement
            socket.broadcast.volatile.emit('updatePlayers', players); 
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));