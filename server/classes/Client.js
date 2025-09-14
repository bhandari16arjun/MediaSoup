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
        this.isAdmin = false;
        this.isApproved = false; // Whether this client has been approved to join
        this.joinRequestId = null; // ID of the join request if pending
        
        // Admin control states
        this.isMutedByAdmin = false;
        this.isVideoDisabledByAdmin = false;
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

    // Admin control methods
    setMutedByAdmin(muted) {
        this.isMutedByAdmin = muted;
        const audioProducer = this.getProducer('audio');
        if (audioProducer) {
            if (muted) {
                audioProducer.pause();
            } else {
                audioProducer.resume();
            }
        }
    }

    setVideoDisabledByAdmin(disabled) {
        this.isVideoDisabledByAdmin = disabled;
        const videoProducer = this.getProducer('video');
        if (videoProducer) {
            if (disabled) {
                videoProducer.pause();
            } else {
                videoProducer.resume();
            }
        }
    }

    // Clean up all transports and producers
    cleanup() {
        // Close all producers
        this.producers.forEach(producer => producer.close());
        this.producers.clear();

        // Close producer transport
        if (this.producerTransport) {
            this.producerTransport.close();
            this.producerTransport = null;
        }

        // Close all consumer transports
        this.consumerTransports.forEach(({ transport }) => transport.close());
        this.consumerTransports.clear();
    }
}

module.exports = Client;