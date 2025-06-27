const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const auctions = {};

function generateCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/player.html'));
});

io.on('connection', (socket) => {
  socket.on('createAuction', (totalIncome) => {
    const code = generateCode();
    auctions[code] = {
      admin: socket.id,
      players: [],
      started: false,
      offers: [],
      totalIncome: totalIncome,
    };
    socket.join(code);
    socket.emit('auctionCreated', code);
  });

  socket.on('joinAuction', ({ code, nickname }) => {
    const auction = auctions[code];
    if (auction && !auction.started) {
      auction.players.push({ id: socket.id, nickname, offer: null });
      socket.join(code);
      io.to(auction.admin).emit('playerListUpdate', auction.players);
      socket.emit('joinedAuction', { code });
    } else {
      socket.emit('error', 'Codice non valido o asta già iniziata.');
    }
  });

  socket.on('startAuction', (code) => {
    const auction = auctions[code];
    if (auction && socket.id === auction.admin) {
      auction.started = true;

      // Generate fair and natural numbers above 1
      const numPlayers = auction.players.length;
      let amounts = [];
      let remaining = auction.totalIncome;

      for (let i = 0; i < numPlayers; i++) {
        const min = 2;
        const max = remaining - 2 * (numPlayers - i - 1);
        const amount = i === numPlayers - 1 ? remaining : Math.floor(Math.random() * (max - min + 1)) + min;
        amounts.push(amount);
        remaining -= amount;
      }

      // Shuffle amounts and assign to players
      amounts.sort(() => Math.random() - 0.5);
      auction.players.forEach((player, index) => {
        io.to(player.id).emit('auctionStarted', { income: amounts[index] });
      });

      io.to(auction.admin).emit('auctionStarted');
    }
  });

  socket.on('submitOffer', ({ code, amount }) => {
    const auction = auctions[code];
    if (!auction || !auction.started) return;

    const player = auction.players.find((p) => p.id === socket.id);
    if (player) {
      player.offer = amount;
      auction.offers.push({ nickname: player.nickname, amount });
      io.to(auction.admin).emit('updateOffers', auction.offers);
    }
  });

  socket.on('endAuction', (code) => {
    const auction = auctions[code];
    if (auction && socket.id === auction.admin) {
      const winner = auction.offers.reduce((prev, curr) => (curr.amount > prev.amount ? curr : prev), { amount: -1 });
      io.to(code).emit('auctionEnded', winner);
    }
  });

  socket.on('disconnect', () => {
    for (const code in auctions) {
      const auction = auctions[code];
      if (auction.admin === socket.id) {
        io.to(code).emit('auctionEnded', { nickname: 'L\'admin ha lasciato.', amount: 0 });
        delete auctions[code];
      } else {
        const index = auction.players.findIndex((p) => p.id === socket.id);
        if (index !== -1) {
          auction.players.splice(index, 1);
          io.to(auction.admin).emit('playerListUpdate', auction.players);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});