const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};
let pickups = [];

// Spawn a random pickup every 8 seconds
setInterval(() => {
    if (pickups.length < 6) {
        pickups.push({
            id: Math.random(),
            x: Math.random() * 800 + 50,
            y: Math.random() * 500 + 50,
            type: Math.random() > 0.5 ? 'SHIELD' : 'SPEED'
        });
        io.emit('updatePickups', pickups);
    }
}, 8000);

io.on('connection', (socket) => {
    players[socket.id] = { 
        x: 400, y: 300, hp: 100, kills: 0, 
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        dir: { x: 1, y: 0 }, bullets: [], 
        isInvincible: false, isShielded: false, speedMult: 1,
        superCharge: 0 
    };

    io.emit('updatePlayers', players);
    io.emit('updatePickups', pickups);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].dir = data.dir;

            // Pickup detection
            pickups = pickups.filter(p => {
                let dist = Math.hypot(players[socket.id].x + 15 - p.x, players[socket.id].y + 15 - p.y);
                if (dist < 30) {
                    applyPowerup(socket.id, p.type);
                    io.emit('updatePickups', pickups);
                    return false;
                }
                return true;
            });
        }
    });

    socket.on('shoot', (data) => {
        const p = players[socket.id];
        if (p) p.bullets.push({ x: p.x + 15, y: p.y + 15, vx: data.dir.x * 15, vy: data.dir.y * 15, life: 80 });
    });

    socket.on('activateSuper', () => {
        const p = players[socket.id];
        if (p && p.superCharge >= 5) {
            p.superCharge = 0;
            const baseAngle = Math.atan2(p.dir.y, p.dir.x);
            for (let i = -2; i <= 2; i++) {
                const angle = baseAngle + (i * 0.25);
                p.bullets.push({ 
                    x: p.x + 15, y: p.y + 15, 
                    vx: Math.cos(angle) * 18, vy: Math.sin(angle) * 18, 
                    life: 45, isSuper: true 
                });
            }
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; io.emit('updatePlayers', players); });
});

function applyPowerup(id, type) {
    const p = players[id];
    if (!p) return;
    if (type === 'SHIELD') {
        p.isShielded = true;
        setTimeout(() => { if(players[id]) p.isShielded = false; }, 5000);
    } else if (type === 'SPEED') {
        p.speedMult = 1.8;
        setTimeout(() => { if(players[id]) p.speedMult = 1; }, 5000);
    }
}

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
                    if (dist < 28 && !t.isInvincible && !t.isShielded) { 
                        t.hp -= 34;
                        p.bullets.splice(bIndex, 1);
                        if (t.hp <= 0) {
                            p.kills++; p.superCharge++;
                            t.hp = 100; t.x = Math.random() * 800; t.y = Math.random() * 600;
                            t.isInvincible = true;
                            io.to(targetId).emit('respawn', { x: t.x, y: t.y });
                            setTimeout(() => { if(players[targetId]) players[targetId].isInvincible = false; }, 1000);
                        }
                        break; 
                    } else if (dist < 35 && t.isShielded) {
                        p.bullets.splice(bIndex, 1);
                    }
                }
            }
            if (b && b.life <= 0) p.bullets.splice(bIndex, 1);
        }
    }
    io.emit('updatePlayers', players);
}, 1000 / 60);

server.listen(process.env.PORT || 3000);
