const WebSocket = require('ws');
const { nowLocalISO } = require('./time');

let wss = null;

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        event: 'connected',
        data: { ts: nowLocalISO() },
      })
    );
  });

  return wss;
}

function broadcast(event, data) {
  if (!wss) return;
  const message = JSON.stringify({ event, data });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function closeWebSocket() {
  if (wss) {
    wss.close();
    wss = null;
  }
}

module.exports = { setupWebSocket, broadcast, closeWebSocket };
