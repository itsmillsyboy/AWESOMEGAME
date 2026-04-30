const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    // Spawn player with 100 HP (3 hearts)
    players[socket.id] = { 
        x: Math.random() * 600 + 100, 
        y: Math.random() * 400 + 100, 
        hp: 100, 
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        dir: { x: 1, y: 0 },
        bullets: [],
        kills: 0,
        isInvincible: false,
        name: "Player_" + socket.id.substring(0, 4)
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
                vx: data.dir.x * 12, vy: data.dir.y * 12, 
                life: 100 
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Main Game Loop (60 FPS)
setInterval(() => {
    for (let id in players) {
        let p = players[id];
        for (let bIndex = p.bullets.length - 1; bIndex >= 0; bIndex--) {
            let b = p.bullets[bIndex];
            b.x += b.vx; b.y += b.vy; b.life--;

            for (let targetId in players) {
                if (targetId !== id) {
                    let t = players[targetId];
                    // Distance-based hitbox
                    let dist = Math.hypot(b.x - (t.x + 15), b.y - (t.y + 15));
                    
                    if (dist < 25 && !t.isInvincible) { 
                        t.hp -= 34; // Takes 3 shots to reach 0
                        p.bullets.splice(bIndex, 1);

                        if (t.hp <= 0) {
                            p.kills++;
                            t.hp = 100;
                            t.x = Math.random() * 600 + 100;
                            t.y = Math.random() * 400 + 100;
                            t.isInvincible = true;
                            
                            // SYNC FIX: Tell player to reset their local position
                            io.to(targetId).emit('respawn', { x: t.x, y: t.y });
                            
                            // End invincibility after 1s
                            setTimeout(() => {
                                if(players[targetId]) players[targetId].isInvincible = false;
                            }, 1000);
                        }
                        break; 
                    }
                }
            }
            if (b.life <= 0 && p.bullets[bIndex]) p.bullets.splice(bIndex, 1);
        }
    }
    io.emit('updatePlayers', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
