const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    // Initial player state
    players[socket.id] = { 
        x: 400, y: 300, 
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        dir: { x: 1, y: 0 }, // Default facing right
        bullets: [],
        kills: 0,
        name: "Guest_" + socket.id.substring(0, 4)
    };

    io.emit('updatePlayers', players);

    socket.on('move', (data) => {
        if(players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].dir = data.dir; // Sync direction facing
        }
    });

    socket.on('shoot', () => {
        const p = players[socket.id];
        if(p && p.bullets.length < 3) { // Max 3 bullets on screen per player
            p.bullets.push({ 
                x: p.x + 15, y: p.y + 15, 
                vx: p.dir.x * 12, 
                vy: p.dir.y * 12,
                life: 60 // Bullet disappears after 60 frames
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Game Logic Heartbeat (60 FPS)
setInterval(() => {
    for(let id in players) {
        let p = players[id];
        p.bullets.forEach((b, bIndex) => {
            b.x += b.vx;
            b.y += b.vy;
            b.life--;

            // Collision Check (One Shot Kill)
            for(let targetId in players) {
                if(targetId !== id) {
                    let t = players[targetId];
                    // Simple hit box (30x30 player size)
                    if(b.x > t.x && b.x < t.x + 30 && b.y > t.y && b.y < t.y + 30) {
                        // Kill detected
                        p.kills++;
                        t.x = Math.random() * 600 + 100; // Respawn
                        t.y = Math.random() * 400 + 100;
                        p.bullets.splice(bIndex, 1);
                        io.to(targetId).emit('death'); // Tell player they died
                    }
                }
            }

            if(b.life <= 0) p.bullets.splice(bIndex, 1);
        });
    }
    io.emit('updatePlayers', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena running on port ${PORT}`));
