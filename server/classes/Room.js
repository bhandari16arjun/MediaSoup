// server/classes/Room.js
const config = require('../config/config');

class Room {
  constructor(roomName, workerToUse) {
    this.roomName = roomName;
    this.worker = workerToUse;
    this.router = null;

    // Map<socketId, Client>
    this.clients = new Map();

    this.admin = null;

    // Map<requestId, { id, userName, socketId, timestamp }>
    this.pendingRequests = new Map();

    this.activeSpeakerList = [];
    this.requestCounter = 0;
  }

  addClient(client) {
    this.clients.set(client.socket.id, client);
    if (!this.admin) {
      this.admin = client;
      client.isAdmin = true;
    }
  }

  removeClient(client) {
    this.clients.delete(client.socket.id);
    if (this.admin && this.admin.socket.id === client.socket.id) {
      const next = this.clients.values().next().value || null;
      this.admin = next || null;
      if (this.admin) this.admin.isAdmin = true;
    }
  }

  addPendingRequest(userName, socketId) {
    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    const request = { id: requestId, userName, socketId, timestamp: Date.now() };
    this.pendingRequests.set(requestId, request);
    return request;
  }

  removePendingRequest(requestId) {
    return this.pendingRequests.delete(requestId);
  }

  getPendingRequest(requestId) {
    return this.pendingRequests.get(requestId);
  }

  getAllPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  isAdminSocket(socketId) {
    return this.admin && this.admin.socket.id === socketId;
  }

  getAdminName() {
    return this.admin ? this.admin.userName : null;
  }

  async createRouter() {
    this.router = await this.worker.createRouter({
      mediaCodecs: config.routerMediaCodecs,
    });
  }
}

module.exports = Room;
