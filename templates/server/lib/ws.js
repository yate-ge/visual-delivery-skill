const WebSocket = require('ws');

let wss = null;

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        event: 'connected',
        data: { ts: new Date().toISOString() },
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
