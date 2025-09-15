// server/server.js
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const config = require('./config/config');
const createWorkers = require('./utilities/createWorkers');
const getWorker = require('./utilities/getWorker');
const Client = require('./classes/Client');
const Room = require('./classes/Room');

const app = express();
const httpServer = http.createServer(app);
const io = socketio(httpServer, { cors: { origin: 'http://localhost:5173' } });

let workers = null;
const rooms = new Map();

init();
async function init() {
  workers = await createWorkers();
  httpServer.listen(config.port, () => console.log(`✅ Server is listening on port ${config.port}`));
}

io.on('connect', (socket) => {
  // Store per-connection client on socket.data
  socket.data.appClient = null;

  socket.on('joinRoom', async ({ userName, roomName }, ackCb) => {
    try {
      let room = rooms.get(roomName);
      if (!room) {
        const worker = await getWorker(workers);
        room = new Room(roomName, worker);
        await room.createRouter();
        rooms.set(roomName, room);
      }

      const client = new Client(userName, socket);
      socket.data.appClient = client;
      client.room = room;

      if (room.clients.size === 0) {
        client.isAdmin = true;
        client.isApproved = true;
        room.addClient(client);
        socket.join(roomName);
        
      // Build list of existing producers from all approved clients (should be empty for first admin)
      const producersToConsume = Array.from(room.clients.values())
        .filter((c) => c.isApproved && c.socket.id !== socket.id)
        .flatMap((c) => Array.from(c.producers.values()).map((p) => ({
          producerId: p.id,
          userName: c.userName,
          remotePeerSocketId: c.socket.id,
        })));
      
      console.log(`👑 Admin joining room ${roomName}, existing producers: ${producersToConsume.length}`);
      
      return ackCb?.({
        routerRtpCapabilities: room.router.rtpCapabilities,
        producersToConsume,
        isAdmin: true,
      });
    }

      // Non-admins must be approved
      const request = room.addPendingRequest(userName, socket.id);
      client.joinRequestId = request.id;

      if (room.admin) {
        io.to(room.admin.socket.id).emit('newJoinRequest', {
          id: request.id,
          userName,
          timestamp: request.timestamp,
        });
      }

      return ackCb?.({ waitingForApproval: true, adminName: room.getAdminName() });
    } catch (e) {
      console.error('joinRoom error:', e);
      return ackCb?.({ error: e.message });
    }
  });

  socket.on('requestJoinRoom', async ({ userName, roomName }, ackCb) => {
    try {
      const room = rooms.get(roomName);
      if (!room) {
        socket.emit('roomNotFound');
        return;
      }
      const client = new Client(userName, socket);
      socket.data.appClient = client;
      client.room = room;

      const request = room.addPendingRequest(userName, socket.id);
      client.joinRequestId = request.id;

      if (room.admin) {
        io.to(room.admin.socket.id).emit('newJoinRequest', {
          id: request.id,
          userName,
          timestamp: request.timestamp,
        });
      }

      ackCb?.({ waitingForApproval: true, adminName: room.getAdminName() });
    } catch (e) {
      console.error('requestJoinRoom error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('adminGetPendingRequests', (callback) => {
    const admin = socket.data.appClient;
    if (admin?.isAdmin && admin.room) {
      const list = admin.room.getAllPendingRequests().map((r) => ({
        id: r.id,
        userName: r.userName,
        timestamp: r.timestamp,
      }));
      callback?.(list);
    } else {
      callback?.([]);
    }
  });

  socket.on('approveJoinRequest', async ({ requestId }, ackCb) => {
    try {
      const admin = socket.data.appClient;
      if (!admin?.isAdmin || !admin.room) return ackCb?.({ error: 'Unauthorized' });

      const room = admin.room;
      const req = room.getPendingRequest(requestId);
      if (!req) return ackCb?.({ error: 'Request not found' });

      const userSocket = io.sockets.sockets.get(req.socketId);
      if (!userSocket) return ackCb?.({ error: 'User disconnected' });

      const userClient = userSocket.data.appClient;
      userClient.isApproved = true;
      room.addClient(userClient);
      userSocket.join(room.roomName);

      // Build list of all existing producers (audio/video) from all approved peers except the new one
      const producersToConsume = Array.from(room.clients.values())
        .filter((c) => c.isApproved && c.socket.id !== userSocket.id)
        .flatMap((c) => Array.from(c.producers.values()).map((p) => ({
          producerId: p.id,
          userName: c.userName,
          remotePeerSocketId: c.socket.id,
        })));

      console.log(`✅ Approving user ${userClient.userName}, sending ${producersToConsume.length} existing producers`);

      room.removePendingRequest(requestId);

      io.to(userSocket.id).emit('joinApproved', {
        routerRtpCapabilities: room.router.rtpCapabilities,
        producersToConsume,
      });
      io.to(admin.socket.id).emit('joinRequestApproved', { requestId });

      // Notify admin to consume the new participant's streams when they start producing
      // This will be handled by the 'newProducer' event when the participant starts producing
      
      // Also notify all other participants about the new participant joining
      // They will consume the new participant's streams when they start producing
      socket.broadcast.to(room.roomName).emit('participantJoined', {
        userName: userClient.userName,
        socketId: userSocket.id
      });

      ackCb?.({ success: true });
    } catch (e) {
      console.error('approveJoinRequest error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('denyJoinRequest', async ({ requestId, reason }, ackCb) => {
    try {
      const admin = socket.data.appClient;
      if (!admin?.isAdmin || !admin.room) return ackCb?.({ error: 'Unauthorized' });

      const room = admin.room;
      const req = room.getPendingRequest(requestId);
      if (!req) return ackCb?.({ error: 'Request not found' });

      const userSocket = io.sockets.sockets.get(req.socketId);
      if (userSocket) {
        io.to(userSocket.id).emit('joinDenied', { reason, adminName: admin.userName });
      }

      room.removePendingRequest(requestId);
      io.to(admin.socket.id).emit('joinRequestDenied', { requestId });
      ackCb?.({ success: true });
    } catch (e) {
      console.error('denyJoinRequest error:', e);
      ackCb?.({ error: e.message });
    }
  });

  // mediasoup transport creation
  socket.on('createTransport', async ({ type, remotePeerSocketId }, ackCb) => {
    const client = socket.data.appClient;
    try {
      if (!client || !client.isApproved) return ackCb?.({ error: 'Not approved' });

      const transport = await client.room.router.createWebRtcTransport({
        listenIps: config.webRtcTransport.listenIps,
        enableUdp: config.webRtcTransport.enableUdp,
        enableTcp: config.webRtcTransport.enableTcp,
        preferUdp: config.webRtcTransport.preferUdp,
        initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
      });

      if (type === 'producer') {
        client.producerTransport = transport;
      } else {
        client.addConsumerTransport(transport, remotePeerSocketId);
      }

      ackCb?.({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (e) {
      console.error('createTransport error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('connectTransport', async ({ transportId, dtlsParameters }, ackCb) => {
    const client = socket.data.appClient;
    try {
      if (!client || !client.isApproved) return ackCb?.({ error: 'Not approved' });

      const transport =
        client.producerTransport?.id === transportId
          ? client.producerTransport
          : Array.from(client.consumerTransports.values()).map((t) => t.transport).find((t) => t.id === transportId);

      if (!transport) return ackCb?.({ error: 'Transport not found' });
      await transport.connect({ dtlsParameters });
      ackCb?.('success');
    } catch (e) {
      console.error('connectTransport error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters }, ackCb) => {
    const client = socket.data.appClient;
    try {
      if (!client || !client.isApproved) return ackCb?.({ error: 'Not approved' });

      const producer = await client.producerTransport.produce({ kind, rtpParameters });
      client.addProducer(producer);

      // Let everyone else in the room know about the new producer (audio or video)
      console.log(`📡 Broadcasting new producer: ${producer.id} from ${client.userName} to room ${client.room.roomName}`);
      socket.broadcast.to(client.room.roomName).emit('newProducer', {
        producerId: producer.id,
        userName: client.userName,
        remotePeerSocketId: client.socket.id,
      });

      ackCb?.({ id: producer.id });
    } catch (e) {
      console.error('produce error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('consume', async ({ rtpCapabilities, producerId, remotePeerSocketId }, ackCb) => {
    const client = socket.data.appClient;
    try {
      if (!client || !client.isApproved) return ackCb?.({ error: 'Not approved' });

      const transportData = client.consumerTransports.get(remotePeerSocketId);
      if (!transportData) return ackCb?.({ error: `Transport for peer ${remotePeerSocketId} not found` });

      if (!client.room.router.canConsume({ producerId, rtpCapabilities })) {
        return ackCb?.({ error: 'Cannot consume' });
      }

      const consumer = await transportData.transport.consume({ producerId, rtpCapabilities, paused: true });
      client.addConsumer(consumer, remotePeerSocketId);

      ackCb?.({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (e) {
      console.error('consume error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('resumeConsumer', async ({ consumerId, remotePeerSocketId }, ackCb) => {
    const client = socket.data.appClient;
    try {
      if (!client || !client.isApproved) return;
      const consumer = client.getConsumer(remotePeerSocketId, consumerId);
      if (consumer) await consumer.resume();
      ackCb?.('resumed');
    } catch (e) {
      console.error('resumeConsumer error:', e);
      ackCb?.({ error: e.message });
    }
  });

  socket.on('producerStateChanged', ({ kind, paused }) => {
    const client = socket.data.appClient;
    if (!client || !client.isApproved) return;
    const producer = client.getProducer(kind);
    if (!producer) return;
    if (paused) producer.pause();
    else producer.resume();

    socket.broadcast.to(client.room.roomName).emit('remoteProducerStateChanged', {
      remotePeerSocketId: client.socket.id,
      kind,
      paused,
    });
  });

  // Admin controls unchanged

  socket.on('disconnect', () => {
    const client = socket.data.appClient;
    if (client && client.room) {
      const room = client.room;

      if (client.joinRequestId) {
        room.removePendingRequest(client.joinRequestId);
        if (room.admin) {
          io.to(room.admin.socket.id).emit('joinRequestDenied', { requestId: client.joinRequestId });
        }
      }

      if (client.isApproved) {
        client.producers.forEach((producer) => {
          socket.to(room.roomName).emit('producerClosed', { producerId: producer.id });
        });
      }

      client.cleanup();
      room.removeClient(client);

      if (room.clients.size === 0) {
        rooms.delete(room.roomName);
        console.log(`🧹 Room ${room.roomName} cleaned up (empty)`);
      }
    }
  });
});
