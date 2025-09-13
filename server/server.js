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

    socket.on('joinRoom', async ({ userName, roomName }, ackCb) => {
        let room = rooms.get(roomName);
        if (!room) {
            const worker = await getWorker(workers);
            room = new Room(roomName, worker);
            await room.createRouter(io);
            rooms.set(roomName, room);
        }

        client = new Client(userName, socket);
        room.addClient(client);
        client.room = room;
        socket.join(roomName);

        const producersToConsume = [];
        room.clients.forEach(c => {
            if (c.socket.id !== socket.id) {
                c.producers.forEach(p => {
                    producersToConsume.push({ producerId: p.id, userName: c.userName, remotePeerSocketId: c.socket.id });
                });
            }
        });
        
        ackCb({ routerRtpCapabilities: room.router.rtpCapabilities, producersToConsume });
    });

    socket.on('createTransport', async ({ type, remotePeerSocketId }, ackCb) => {
        if (!client) return ackCb({ error: 'Client not initialized' });
        try {
            const { listenIps } = config.webRtcTransport;
            const transport = await client.room.router.createWebRtcTransport({ listenInfos: listenIps, enableUdp: true, enableTcp: true, preferUdp: true });
            
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
        if (!client) return ackCb({ error: 'Client not initialized' });
        const transport =
            client.producerTransport?.id === transportId
                ? client.producerTransport
                : Array.from(client.consumerTransports.values()).map(t => t.transport).find(t => t.id === transportId);

        if (!transport) return ackCb({ error: 'Transport not found' });
        await transport.connect({ dtlsParameters });
        ackCb('success');
    });

    socket.on('produce', async ({ kind, rtpParameters, transportId }, ackCb) => {
        if (!client) return ackCb({ error: 'Client not initialized' });
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
        if (!client) return ackCb({ error: 'Client not initialized' });
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
        if (!client) return;
        const consumer = client.getConsumer(remotePeerSocketId, consumerId);
        if (consumer) {
            await consumer.resume();
        }
        ackCb('resumed');
    });

    // THIS IS THE NEW HANDLER FOR MUTE/UNMUTE
    socket.on('producerStateChanged', ({ kind, paused }) => {
        if (!client) return;
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

    socket.on('disconnect', () => {
        if (client && client.room) {
            client.producers.forEach(producer => {
                socket.to(client.room.roomName).emit('producerClosed', { producerId: producer.id });
            });
            client.room.clients = client.room.clients.filter(c => c.socket.id !== socket.id);
        }
    });
});