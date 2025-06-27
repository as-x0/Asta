const socket = io();
const pathname = window.location.pathname;

if (pathname.includes('admin')) {
  const createForm = document.getElementById('createForm');
  const adminPanel = document.getElementById('adminPanel');
  const auctionCodeEl = document.getElementById('auctionCode');
  const playersList = document.getElementById('playersList');
  const offersList = document.getElementById('offersList');
  const winnerResult = document.getElementById('winnerResult');

  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const totalIncome = parseInt(document.getElementById('totalIncome').value);
    socket.emit('createAuction', totalIncome);
  });

  socket.on('auctionCreated', (code) => {
    document.getElementById('createForm').hidden = true;
    adminPanel.hidden = false;
    auctionCodeEl.textContent = code;
  });

  socket.on('playerListUpdate', (players) => {
    playersList.innerHTML = players.map(p => `<li>${p.nickname}</li>`).join('');
  });

  document.getElementById('startAuction').addEventListener('click', () => {
    socket.emit('startAuction', auctionCodeEl.textContent);
  });

  document.getElementById('endAuction').addEventListener('click', () => {
    socket.emit('endAuction', auctionCodeEl.textContent);
  });

  socket.on('updateOffers', (offers) => {
    offersList.innerHTML = offers.map(o => `<li>${o.nickname}: ${o.amount}</li>`).join('');
  });

  socket.on('auctionEnded', (winner) => {
    document.getElementById('winnerMessage').textContent = 
      `Vincitore: ${winner.nickname} con offerta di ${winner.amount}`;
    winnerResult.hidden = false;
  });

} else if (pathname.includes('player')) {
  const joinForm = document.getElementById('joinForm');
  const waiting = document.getElementById('waiting');
  const bidSection = document.getElementById('bidSection');
  const result = document.getElementById('result');

  let auctionCode = '';

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('code').value.toUpperCase();
    const nickname = document.getElementById('nickname').value;
    socket.emit('joinAuction', { code, nickname });
  });

  socket.on('joinedAuction', (data) => {
    auctionCode = data.code;
    joinForm.hidden = true;
    waiting.hidden = false;
  });

  socket.on('auctionStarted', (data) => {
    waiting.hidden = true;
    bidSection.hidden = false;
    document.getElementById('income').textContent = data.income;
  });

  document.getElementById('submitOffer').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('offerAmount').value);
    const income = parseInt(document.getElementById('income').textContent);

    if (isNaN(amount) || amount < 1) {
      alert("Inserisci un'offerta valida (numero naturale maggiore di 0).");
      return;
    }

    if (amount > income) {
      alert("L'offerta non può superare il tuo denaro disponibile.");
      return;
    }

    socket.emit('submitOffer', { code: auctionCode, amount });
  });


  socket.on('auctionEnded', (winner) => {
    bidSection.hidden = true;
    result.hidden = false;
    result.innerHTML = `<h4>Vincitore: ${winner.nickname} con offerta di ${winner.amount}</h4>`;
  });

  socket.on('error', (msg) => alert(msg));
}