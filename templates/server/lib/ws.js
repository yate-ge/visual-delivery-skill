const WebSocket = require('ws');
const { readJSONArray } = require('./store');

let wss = null;

function setupWebSocket(server, indexPath) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    // On new connection, send pending blocking deliveries
    const index = readJSONArray(indexPath);
    const blocking = index.filter(d =>
      d.mode === 'blocking' && d.status === 'awaiting_feedback'
    );
    blocking.forEach(d => {
      ws.send(JSON.stringify({ event: 'new_delivery', data: d }));
    });
  });

  return wss;
}

function broadcast(event, data) {
  if (!wss) return;
  const message = JSON.stringify({ event, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function closeWebSocket() {
  if (wss) wss.close();
}

module.exports = { setupWebSocket, broadcast, closeWebSocket };
