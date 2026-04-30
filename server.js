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
        x: Math.random() * 600 + 100, 
        y: Math.random() * 400 + 100, 
        hp: 100, 
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        dir: { x: 1, y: 0 },
        bullets: [],
        kills: 0,
        isInvincible: false
    };

    io.emit('updatePlayers', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].dir = data.dir;
        }
    });

    socket.on('shoot', (data) => {
        const p = players[socket.id];
        if (p && data && data.dir) {
            p.bullets.push({ 
                x: p.x + 15, y: p.y + 15, 
                vx: data.dir.x * 14, vy: data.dir.y * 14, 
                life: 80 
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

setInterval(() => {
    for (let id in players) {
        let p = players[id];
        for (let bIndex = p.bullets.length - 1; bIndex >= 0; bIndex--) {
            let b = p.bullets[bIndex];
            b.x += b.vx; b.y += b.vy; b.life--;

            for (let targetId in players) {
                if (targetId !== id) {
                    let t = players[targetId];
                    let dist = Math.hypot(b.x - (t.x + 15), b.y - (t.y + 15));
                    
                    if (dist < 28 && !t.isInvincible) { 
                        t.hp -= 34;
                        // Tell everyone an impact happened at this spot (for particles)
                        io.emit('impact', { x: b.x, y: b.y, color: t.color });
                        p.bullets.splice(bIndex, 1);

                        if (t.hp <= 0) {
                            p.kills++;
                            t.hp = 100;
                            t.x = Math.random() * (800); t.y = Math.random() * (600);
                            t.isInvincible = true;
                            io.to(targetId).emit('respawn', { x: t.x, y: t.y });
                            setTimeout(() => { if(players[targetId]) players[targetId].isInvincible = false; }, 1000);
                        }
                        break; 
                    }
                }
            }
            if (b && b.life <= 0) p.bullets.splice(bIndex, 1);
        }
    }
    io.emit('updatePlayers', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Neon Arena Professional live on ${PORT}`));
