// server/classes/Client.js

class Client {
    constructor(userName, socket) {
        this.userName = userName;
        this.socket = socket;
        this.producerTransport = null;
        this.producers = new Map(); // key: kind ('audio' or 'video'), value: producer
        // Key: remotePeerSocketId, Value: { transport, consumers: Map }
        this.consumerTransports = new Map(); 
        this.room = null;
    }

    addProducer(producer) {
        this.producers.set(producer.kind, producer);
    }

    getProducer(kind) {
        return this.producers.get(kind);
    }

    closeProducer(kind) {
        this.producers.get(kind)?.close();
        this.producers.delete(kind);
    }

    // A consumer transport is a transport on THIS client that receives media from a remote peer
    addConsumerTransport(transport, remotePeerSocketId) {
        this.consumerTransports.set(remotePeerSocketId, { transport, consumers: new Map() });
    }

    addConsumer(consumer, remotePeerSocketId) {
        const transportData = this.consumerTransports.get(remotePeerSocketId);
        if (transportData) {
            transportData.consumers.set(consumer.id, consumer);
        }
    }

    getConsumer(remotePeerSocketId, consumerId) {
        const transportData = this.consumerTransports.get(remotePeerSocketId);
        return transportData?.consumers.get(consumerId);
    }
}

module.exports = Client;