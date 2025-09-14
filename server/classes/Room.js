const config = require('../config/config')
const newDominantSpeaker = require('../utilities/newDominantSpeaker')

class Room{
    constructor(roomName, workerToUse){
        this.roomName = roomName
        this.worker = workerToUse
        this.router = null
        // All the Client objects that are in this room
        this.clients = []
        // Admin client reference
        this.admin = null
        // Pending join requests { id, userName, socket, timestamp }
        this.pendingRequests = new Map()
        // An array of id's with the most recent dominant speaker first
        this.activeSpeakerList = []
        // Request counter for unique IDs
        this.requestCounter = 0
    }

    addClient(client){
        this.clients.push(client)
        // First client becomes admin
        if (this.clients.length === 1) {
            this.admin = client
            client.isAdmin = true
        }
    }

    removeClient(clientSocket){
        this.clients = this.clients.filter(c => c.socket.id !== clientSocket.id)
        
        // If admin leaves, end the room or transfer admin to next person
        if (this.admin && this.admin.socket.id === clientSocket.id) {
            if (this.clients.length > 0) {
                // Transfer admin to the next person
                this.admin = this.clients[0]
                this.admin.isAdmin = true
            } else {
                this.admin = null
            }
        }
    }

    addPendingRequest(userName, socket) {
        const requestId = `req_${++this.requestCounter}_${Date.now()}`
        const request = {
            id: requestId,
            userName,
            socket,
            timestamp: Date.now()
        }
        
        this.pendingRequests.set(requestId, request)
        return request
    }

    removePendingRequest(requestId) {
        return this.pendingRequests.delete(requestId)
    }

    getPendingRequest(requestId) {
        return this.pendingRequests.get(requestId)
    }

    getAllPendingRequests() {
        return Array.from(this.pendingRequests.values())
    }

    isAdmin(clientSocket) {
        return this.admin && this.admin.socket.id === clientSocket.id
    }

    getAdminName() {
        return this.admin ? this.admin.userName : null
    }

    createRouter(io){
        return new Promise(async(resolve, reject)=>{
            this.router = await this.worker.createRouter({
                mediaCodecs: config.routerMediaCodecs
            })
            this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
                interval: 300 // 300 is default
            })
            this.activeSpeakerObserver.on('dominantspeaker', ds => newDominantSpeaker(ds, this, io))
            resolve()
        })
    }
}

module.exports = Room