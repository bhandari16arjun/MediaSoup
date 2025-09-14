const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const mediasoup = require('mediasoup');

const config = require('./config/config');
const createWorkers = require('./utilities/createWorkers');
const getWorker = require('./utilities/getWorker');
const Client = require('./classes/Client');
const Room = require('./classes/Room');

const app = express();
const httpServer = http.createServer(app);
const io = socketio(httpServer, { cors: { origin: "http://localhost:5173" } });

let workers = null;
const rooms = new Map();

init();
async function init() {
    workers = await createWorkers();
    httpServer.listen(config.port, () => console.log(`✅ Server is listening on port ${config.port}`));
}

io.on('connect', socket => {
    let client;

    // Handle join room requests (for both admin and regular users)
    socket.on('joinRoom', async ({ userName, roomName }, ackCb) => {
    console.log(`👋 ${userName} attempting to join room ${roomName}`);
    
    let room = rooms.get(roomName);
    
    // If room doesn't exist, create it (admin is joining)
    if (!room) {
        const worker = await getWorker(workers);
        room = new Room(roomName, worker);
        await room.createRouter(io);
        rooms.set(roomName, room);
        
        // Create admin client
        client = new Client(userName, socket);
        client.isAdmin = true;
        client.isApproved = true;
        room.addClient(client);
        client.room = room;
        socket.join(roomName);

        console.log(`🏠 Room ${roomName} created by admin: ${userName}`);
        
        const producersToConsume = [];
        ackCb({ 
            routerRtpCapabilities: room.router.rtpCapabilities, 
            producersToConsume,
            isAdmin: true 
        });
        return;
    }

    // Room exists - check if user should join directly or wait for approval
    client = new Client(userName, socket);
    client.room = room;
    
    // If there's an admin, user needs approval (unless they're admin rejoining)
    if (room.admin && !client.isAdmin) {
        // This user needs approval - don't add to room yet
        const request = room.addPendingRequest(userName, socket);
        client.joinRequestId = request.id;
        
        // Notify admin of pending request
        io.to(room.admin.socket.id).emit('newJoinRequest', {
            id: request.id,
            userName,
            timestamp: request.timestamp
        });

        console.log(`⏳ ${userName} requesting approval for room ${roomName}`);
        ackCb({ waitingForApproval: true, adminName: room.getAdminName() });
        return;
    }

    // No admin or this is admin rejoining - join directly
    room.addClient(client);
    socket.join(roomName);
    client.isApproved = true;

    const producersToConsume = [];
    room.clients.forEach(c => {
        if (c.socket.id !== socket.id && c.isApproved) {
            c.producers.forEach(p => {
                producersToConsume.push({ 
                    producerId: p.id, 
                    userName: c.userName, 
                    remotePeerSocketId: c.socket.id 
                });
            });
        }
    });
    
    console.log(`✅ ${userName} joined room ${roomName} directly`);
    ackCb({ 
        routerRtpCapabilities: room.router.rtpCapabilities, 
        producersToConsume,
        isAdmin: client.isAdmin 
    });
});

    // Handle join requests from waiting room
    socket.on('requestJoinRoom', async ({ userName, roomName }, ackCb) => {
        const room = rooms.get(roomName);
        
        if (!room) {
            socket.emit('roomNotFound');
            return;
        }

        if (!room.admin) {
            // No admin, allow direct join
            const request = room.addPendingRequest(userName, socket);
            client = new Client(userName, socket);
            client.joinRequestId = request.id;
            client.room = room;
            ackCb?.({ status: 'waiting' });
            return;
        }

        // Add to pending requests
        const request = room.addPendingRequest(userName, socket);
        client = new Client(userName, socket);
        client.joinRequestId = request.id;
        client.room = room;

        // Notify admin
        io.to(room.admin.socket.id).emit('newJoinRequest', {
            id: request.id,
            userName,
            timestamp: request.timestamp
        });

        console.log(`👋 ${userName} requesting to join room ${roomName} from waiting room`);
        ackCb?.({ status: 'waiting', adminName: room.getAdminName() });
    });

    // Admin approves join request
    socket.on('approveJoinRequest', async ({ requestId }, ackCb) => {
    if (!client || !client.isAdmin || !client.room) {
        ackCb?.({ error: 'Unauthorized' });
        return;
    }

    const room = client.room;
    const request = room.getPendingRequest(requestId);
    
    if (!request) {
        ackCb?.({ error: 'Request not found' });
        return;
    }

    // Create client for the approved user
    const newClient = new Client(request.userName, request.socket);
    newClient.isApproved = true;
    newClient.room = room;
    room.addClient(newClient);
    request.socket.join(room.roomName);

    // Get existing producers for the new user
    const producersToConsume = [];
    room.clients.forEach(c => {
        if (c.socket.id !== request.socket.id && c.isApproved) {
            c.producers.forEach(p => {
                producersToConsume.push({ 
                    producerId: p.id, 
                    userName: c.userName, 
                    remotePeerSocketId: c.socket.id 
                });
            });
        }
    });

    // Remove from pending requests
    room.removePendingRequest(requestId);

    // Notify the user they're approved with MediaSoup capabilities
    io.to(request.socket.id).emit('joinApproved', { 
        adminName: client.userName,
        routerRtpCapabilities: room.router.rtpCapabilities,
        producersToConsume
    });

    // Notify admin
    io.to(client.socket.id).emit('joinRequestApproved', { requestId });

    console.log(`✅ ${client.userName} approved ${request.userName} to join room ${room.roomName}`);
    ackCb?.({ success: true });
});

    // Admin denies join request
    socket.on('denyJoinRequest', async ({ requestId, reason }, ackCb) => {
        if (!client || !client.isAdmin || !client.room) {
            ackCb?.({ error: 'Unauthorized' });
            return;
        }

        const room = client.room;
        const request = room.getPendingRequest(requestId);
        
        if (!request) {
            ackCb?.({ error: 'Request not found' });
            return;
        }

        // Notify the user they're denied
        io.to(request.socket.id).emit('joinDenied', { 
            reason,
            adminName: client.userName 
        });

        // Notify admin
        io.to(client.socket.id).emit('joinRequestDenied', { requestId });

        // Remove from pending requests
        room.removePendingRequest(requestId);

        console.log(`❌ ${client.userName} denied ${request.userName} access to room ${room.roomName}`);
        ackCb?.({ success: true });
    });

    // Existing MediaSoup handlers...
    socket.on('createTransport', async ({ type, remotePeerSocketId }, ackCb) => {
        if (!client || !client.isApproved) return ackCb({ error: 'Not approved' });
        try {
            const { listenIps } = config.webRtcTransport;
            const transport = await client.room.router.createWebRtcTransport({ 
                listenInfos: listenIps, 
                enableUdp: true, 
                enableTcp: true, 
                preferUdp: true 
            });
            
            if (type === 'producer') {
                client.producerTransport = transport;
            } else {
                client.addConsumerTransport(transport, remotePeerSocketId);
            }

            ackCb({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (e) {
            ackCb({ error: e.message });
        }
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }, ackCb) => {
        if (!client || !client.isApproved) return ackCb({ error: 'Not approved' });
        const transport =
            client.producerTransport?.id === transportId
                ? client.producerTransport
                : Array.from(client.consumerTransports.values()).map(t => t.transport).find(t => t.id === transportId);

        if (!transport) return ackCb({ error: 'Transport not found' });
        await transport.connect({ dtlsParameters });
        ackCb('success');
    });

    socket.on('produce', async ({ kind, rtpParameters, transportId }, ackCb) => {
        if (!client || !client.isApproved) return ackCb({ error: 'Not approved' });
        const producer = await client.producerTransport.produce({ kind, rtpParameters });
        client.addProducer(producer);
        
        socket.broadcast.to(client.room.roomName).emit('newProducer', {
            producerId: producer.id,
            userName: client.userName,
            remotePeerSocketId: client.socket.id
        });
        
        ackCb({ id: producer.id });
    });

    socket.on('consume', async ({ rtpCapabilities, producerId, remotePeerSocketId }, ackCb) => {
        if (!client || !client.isApproved) return ackCb({ error: 'Not approved' });
        try {
            const transportData = client.consumerTransports.get(remotePeerSocketId);
            if (!transportData) return ackCb({ error: `Transport for peer ${remotePeerSocketId} not found` });

            if (!client.room.router.canConsume({ producerId, rtpCapabilities })) {
                return ackCb({ error: 'Cannot consume' });
            }
            
            const consumer = await transportData.transport.consume({ producerId, rtpCapabilities, paused: true });
            client.addConsumer(consumer, remotePeerSocketId);

            ackCb({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
        } catch (e) {
            ackCb({ error: e.message });
        }
    });

    socket.on('resumeConsumer', async ({ consumerId, remotePeerSocketId }, ackCb) => {
        if (!client || !client.isApproved) return;
        const consumer = client.getConsumer(remotePeerSocketId, consumerId);
        if (consumer) {
            await consumer.resume();
        }
        ackCb?.('resumed');
    });

    // Producer state change (mute/unmute, video on/off)
    socket.on('producerStateChanged', ({ kind, paused }) => {
        if (!client || !client.isApproved) return;
        const producer = client.getProducer(kind);
        if (!producer) return;
        
        if (paused) {
            producer.pause();
        } else {
            producer.resume();
        }
        
        // Notify other clients in the room of the state change
        socket.broadcast.to(client.room.roomName).emit('remoteProducerStateChanged', {
            remotePeerSocketId: client.socket.id,
            kind,
            paused
        });
    });

    // Admin control handlers
    socket.on('adminMuteParticipant', async ({ participantId, mute }, ackCb) => {
        if (!client || !client.isAdmin) return ackCb?.({ error: 'Unauthorized' });
        
        const targetClient = client.room.clients.find(c => c.socket.id === participantId);
        if (!targetClient) return ackCb?.({ error: 'Participant not found' });

        targetClient.setMutedByAdmin(mute);
        
        // Notify the participant
        io.to(participantId).emit('adminMuted', { 
            muted: mute, 
            by: client.userName 
        });

        // Notify other participants of the state change
        socket.broadcast.to(client.room.roomName).emit('remoteProducerStateChanged', {
            remotePeerSocketId: participantId,
            kind: 'audio',
            paused: mute
        });

        console.log(`🔇 ${client.userName} ${mute ? 'muted' : 'unmuted'} ${targetClient.userName}`);
        ackCb?.({ success: true });
    });

    socket.on('adminDisableVideo', async ({ participantId, disable }, ackCb) => {
        if (!client || !client.isAdmin) return ackCb?.({ error: 'Unauthorized' });
        
        const targetClient = client.room.clients.find(c => c.socket.id === participantId);
        if (!targetClient) return ackCb?.({ error: 'Participant not found' });

        targetClient.setVideoDisabledByAdmin(disable);
        
        // Notify the participant
        io.to(participantId).emit('adminVideoDisabled', { 
            disabled: disable, 
            by: client.userName 
        });

        // Notify other participants of the state change
        socket.broadcast.to(client.room.roomName).emit('remoteProducerStateChanged', {
            remotePeerSocketId: participantId,
            kind: 'video',
            paused: disable
        });

        console.log(`📹 ${client.userName} ${disable ? 'disabled' : 'enabled'} video for ${targetClient.userName}`);
        ackCb?.({ success: true });
    });

    socket.on('adminRemoveParticipant', async ({ participantId }, ackCb) => {
        if (!client || !client.isAdmin) return ackCb?.({ error: 'Unauthorized' });
        
        const targetClient = client.room.clients.find(c => c.socket.id === participantId);
        if (!targetClient) return ackCb?.({ error: 'Participant not found' });

        // Notify the participant they're being removed
        io.to(participantId).emit('removedFromMeeting', { 
            by: client.userName,
            reason: 'You have been removed from the meeting by the host' 
        });

        // Notify other participants
        socket.broadcast.to(client.room.roomName).emit('participantLeft', {
            userName: targetClient.userName,
            reason: 'removed'
        });

        // Clean up and disconnect
        targetClient.cleanup();
        client.room.removeClient(targetClient.socket);
        targetClient.socket.leave(client.room.roomName);
        targetClient.socket.disconnect(true);

        console.log(`🚫 ${client.userName} removed ${targetClient.userName} from room ${client.room.roomName}`);
        ackCb?.({ success: true });
    });

    socket.on('adminEndMeeting', ({ roomName }) => {
        if (!client || !client.isAdmin) return;
        
        // Notify all participants that admin is ending the meeting
        socket.broadcast.to(roomName).emit('adminLeft', {
            adminName: client.userName,
            reason: 'The meeting host has ended the meeting'
        });

        console.log(`🔚 Admin ${client.userName} ended meeting ${roomName}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (client && client.room) {
            // If this was a pending request, remove it
            if (client.joinRequestId) {
                client.room.removePendingRequest(client.joinRequestId);
                if (client.room.admin) {
                    io.to(client.room.admin.socket.id).emit('joinRequestDenied', { 
                        requestId: client.joinRequestId 
                    });
                }
            }

            // Notify other clients about producers closing
            if (client.isApproved) {
                client.producers.forEach(producer => {
                    socket.to(client.room.roomName).emit('producerClosed', { producerId: producer.id });
                });
            }

            // Clean up client
            client.cleanup();
            client.room.removeClient(client.socket);

            // If admin left, notify remaining clients
            if (client.isAdmin && client.room.clients.length > 0) {
                socket.broadcast.to(client.room.roomName).emit('adminLeft', {
                    adminName: client.userName,
                    reason: 'The meeting host has left the meeting'
                });
            }

            // If room is empty, clean it up
            if (client.room.clients.length === 0) {
                rooms.delete(client.room.roomName);
                console.log(`🧹 Room ${client.room.roomName} cleaned up (empty)`);
            }

            console.log(`👋 ${client.userName} disconnected from room ${client.room.roomName}`);
        }
    });
});