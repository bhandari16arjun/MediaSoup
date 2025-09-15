// server/classes/Client.js
class Client {
  constructor(userName, socket) {
    this.userName = userName;
    this.socket = socket;

    this.producerTransport = null;
    // kind -> Producer
    this.producers = new Map();

    // remotePeerSocketId -> { transport, consumers: Map(consumerId -> Consumer) }
    this.consumerTransports = new Map();

    this.room = null;
    this.isAdmin = false;
    this.isApproved = false;
    this.joinRequestId = null;

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

  addConsumerTransport(transport, remotePeerSocketId) {
    this.consumerTransports.set(remotePeerSocketId, { transport, consumers: new Map() });
  }

  addConsumer(consumer, remotePeerSocketId) {
    const transportData = this.consumerTransports.get(remotePeerSocketId);
    if (transportData) transportData.consumers.set(consumer.id, consumer);
  }

  getConsumer(remotePeerSocketId, consumerId) {
    return this.consumerTransports.get(remotePeerSocketId)?.consumers.get(consumerId);
  }

  setMutedByAdmin(muted) {
    this.isMutedByAdmin = muted;
    const audio = this.getProducer('audio');
    if (!audio) return;
    if (muted) audio.pause();
    else audio.resume();
  }

  setVideoDisabledByAdmin(disabled) {
    this.isVideoDisabledByAdmin = disabled;
    const video = this.getProducer('video');
    if (!video) return;
    if (disabled) video.pause();
    else video.resume();
  }

  cleanup() {
    this.producers.forEach(p => p.close());
    this.producers.clear();
    if (this.producerTransport) {
      this.producerTransport.close();
      this.producerTransport = null;
    }
    this.consumerTransports.forEach(({ transport }) => transport.close());
    this.consumerTransports.clear();
  }
}

module.exports = Client;
