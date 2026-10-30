const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;
const roomConnections = new Map(); // roomId -> Set of WebSocket clients

// Rate limit: max messages per socket per window
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX = 20;           // max messages per window

// Heartbeat interval
const HEARTBEAT_INTERVAL_MS = 30_000;

function initRealtime(server) {
  const JWT_SECRET = process.env.JWT_SECRET;

  wss = new WebSocket.Server({ server, path: '/ws' });

  // Heartbeat: ping every 30s, drop sockets that don't pong
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach(ws => {
      if (ws._isAlive === false) return ws.terminate();
      ws._isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws, req) => {
    let currentRoomId = null;
    let userId = null;
    let userName = null;
    let authenticated = false;

    // Rate limiting state per socket
    let messageCount = 0;
    let windowStart = Date.now();

    // Heartbeat tracking
    ws._isAlive = true;
    ws.on('pong', () => { ws._isAlive = true; });

    // Require JWT as first message (AUTH)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        // Rate limiting
        const now = Date.now();
        if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
          messageCount = 0;
          windowStart = now;
        }
        messageCount++;
        if (messageCount > RATE_LIMIT_MAX) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit exceeded' }));
          return;
        }

        // AUTH: Must authenticate before anything else
        if (data.type === 'AUTH') {
          if (!JWT_SECRET || !data.token) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Authentication required' }));
            ws.close();
            return;
          }
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET);
            userId = decoded.id;
            userName = decoded.email || `User ${decoded.id}`;
            authenticated = true;
            ws.send(JSON.stringify({ type: 'AUTH_OK', userId }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid or expired token' }));
            ws.close();
            return;
          }
          return;
        }

        // Reject all other messages until authenticated
        if (!authenticated) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Authentication required. Send AUTH message first.' }));
          ws.close();
          return;
        }

        // Join Study Room
        if (data.type === 'JOIN_ROOM') {
          // Remove from previous room before joining new one
          if (currentRoomId && roomConnections.has(currentRoomId)) {
            roomConnections.get(currentRoomId).delete(ws);
            broadcastToRoom(currentRoomId, {
              type: 'USER_LEFT',
              userId,
              activeCount: roomConnections.get(currentRoomId).size
            });
          }

          currentRoomId = data.roomId;
          // userId is already set from the authenticated token, never from the client

          if (!roomConnections.has(currentRoomId)) {
            roomConnections.set(currentRoomId, new Set());
          }
          roomConnections.get(currentRoomId).add(ws);

          broadcastToRoom(currentRoomId, {
            type: 'USER_JOINED',
            userId,
            activeCount: roomConnections.get(currentRoomId).size
          });
        }

        // Room Chat Message
        if (data.type === 'ROOM_MESSAGE') {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'NEW_MESSAGE',
            // Sender is taken from the authenticated user, not from message body
            sender: userName,
            senderId: userId,
            text: data.text,
            timestamp: new Date().toISOString()
          });
        }

        // Timer Tick Sync
        if (data.type === 'TIMER_SYNC') {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'TIMER_UPDATE',
            secondsLeft: data.secondsLeft
          });
        }
      } catch (e) {
        console.warn('WS Message Error:', e.message);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && roomConnections.has(currentRoomId)) {
        roomConnections.get(currentRoomId).delete(ws);
        broadcastToRoom(currentRoomId, {
          type: 'USER_LEFT',
          userId,
          activeCount: roomConnections.get(currentRoomId).size
        });
      }
    });
  });

  console.log('⚡ Real-time WebSockets Engine active on /ws');
}

function broadcastToRoom(roomId, payload) {
  if (!roomId || !roomConnections.has(roomId)) return;
  const clients = roomConnections.get(roomId);
  const jsonStr = JSON.stringify(payload);

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

module.exports = {
  initRealtime,
  broadcastToRoom
};
