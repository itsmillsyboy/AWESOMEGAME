const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    players[socket.id] = { 
        x: 300, y: 300, hp: 100, bullets: [], 
        color: `hsl(${Math.random() * 360}, 80%, 60%)` 
    };

    socket.on('move', (data) => {
        if(players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('shoot', () => {
        const p = players[socket.id];
        if(p && p.bullets.length < 5) {
            p.bullets.push({ x: p.x + 15, y: p.y + 15, vx: 10, vy: 0 });
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

// Game Logic Heartbeat (Runs 60 times a second)
setInterval(() => {
    for(let id in players) {
        let p = players[id];
        p.bullets.forEach((b, index) => {
            b.x += b.vx;
            // Check collisions with other players
            for(let targetId in players) {
                if(targetId !== id) {
                    let t = players[targetId];
                    if(b.x > t.x && b.x < t.x+30 && b.y > t.y && b.y < t.y+30) {
                        t.hp -= 10;
                        p.bullets.splice(index, 1);
                        if(t.hp <= 0) { t.hp = 100; t.x = Math.random()*500; t.y = Math.random()*500; }
                    }
                }
            }
            if(b.x > 2000) p.bullets.splice(index, 1);
        });
    }
    io.emit('updatePlayers', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Gaming on port ${PORT}`));
