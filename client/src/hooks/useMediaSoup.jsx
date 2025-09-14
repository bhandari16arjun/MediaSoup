import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { useSocket } from '@/lib/socket.jsx';

export const useMediasoup = () => {
    const { roomId } = useParams();
    const socket = useSocket();

    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isInitialized, setIsInitialized] = useState(false);
    
    const localAudioTrackRef = useRef(null);
    const localVideoTrackRef = useRef(null); 
    
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const audioProducerRef = useRef(null);
    const videoProducerRef = useRef(null);
    const consumerTransportsRef = useRef({});

    // Get user info
    const getUserInfo = useCallback(() => {
        const adminInfo = localStorage.getItem('meetingAdmin');
        const userInfo = localStorage.getItem('meetingUser');
        
        if (adminInfo) {
            return JSON.parse(adminInfo);
        } else if (userInfo) {
            return JSON.parse(userInfo);
        }
        return null;
    }, []);

    const produce = useCallback(async (stream) => {
        if (!deviceRef.current || !socket) return;
        try {
            const transportParams = await socket.emitWithAck('createTransport', { type: 'producer' });
            if (transportParams.error) throw new Error(transportParams.error);

            const transport = deviceRef.current.createSendTransport(transportParams);
            producerTransportRef.current = transport;

            transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await socket.emitWithAck('connectTransport', { transportId: transport.id, dtlsParameters });
                    callback();
                } catch (e) { errback(e); }
            });

            transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                try {
                    const { id } = await socket.emitWithAck('produce', { transportId: transport.id, kind, rtpParameters });
                    callback({ id });
                } catch (e) { errback(e); }
            });

            if (stream.getAudioTracks()[0]) {
                audioProducerRef.current = await transport.produce({ track: stream.getAudioTracks()[0] });
            }
            if (stream.getVideoTracks()[0]) {
                videoProducerRef.current = await transport.produce({ track: stream.getVideoTracks()[0] });
            }
        } catch (error) { 
            console.error("Error in produce():", error); 
        }
    }, [socket]);

    const consume = useCallback(async (producerId, userName, remotePeerSocketId) => {
        if (!deviceRef.current || !socket) return;
        try {
            let transportData = consumerTransportsRef.current[remotePeerSocketId];

            if (!transportData) {
                const transportParams = await socket.emitWithAck('createTransport', { type: 'consumer', remotePeerSocketId });
                if (transportParams.error) throw new Error(transportParams.error);
                const transport = deviceRef.current.createRecvTransport(transportParams);
                
                transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                    socket.emitWithAck('connectTransport', { transportId: transport.id, dtlsParameters }).then(callback).catch(errback);
                });
                
                transportData = { transport, consumers: new Map() };
                consumerTransportsRef.current[remotePeerSocketId] = transportData;
            }
            
            const consumerParams = await socket.emitWithAck('consume', { rtpCapabilities: deviceRef.current.rtpCapabilities, producerId, remotePeerSocketId });
            if (consumerParams.error) throw new Error(consumerParams.error);
            
            const consumer = await transportData.transport.consume(consumerParams);
            transportData.consumers.set(consumer.id, consumer);

            await socket.emitWithAck('resumeConsumer', { consumerId: consumer.id, remotePeerSocketId });

            setRemoteStreams(prev => {
                const existingPeer = prev[remotePeerSocketId] || { userName, streams: new Map(), consumers: new Map(), isAudioMuted: false, isVideoOff: false };
                existingPeer.streams.set(consumer.kind, new MediaStream([consumer.track]));
                existingPeer.consumers.set(consumer.kind, consumer);
                
                return {
                    ...prev,
                    [remotePeerSocketId]: {
                        ...existingPeer,
                        combinedStream: new MediaStream([...existingPeer.streams.values()].flatMap(s => s.getTracks())),
                    }
                };
            });
        } catch (error) { 
            console.error("Error in consume():", error); 
        }
    }, [socket]);
    
    useEffect(() => {
        const init = async () => {
            try {
                const userInfo = getUserInfo();
                if (!userInfo || !socket || !roomId) return;

                console.log("🚀 Initializing MediaSoup for:", userInfo.userName, "Admin:", userInfo.isAdmin);

                // Get user media
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localAudioTrackRef.current = stream.getAudioTracks()[0];
                localVideoTrackRef.current = stream.getVideoTracks()[0];
                setLocalStream(stream);

                // Join room
                const joinResult = await socket.emitWithAck('joinRoom', { 
                    userName: userInfo.userName, 
                    roomName: roomId 
                });

                // Handle different join scenarios
                if (joinResult.waitingForApproval) {
                    console.log("⏳ Waiting for admin approval");
                    return; // Don't initialize MediaSoup yet
                }

                if (joinResult.error) {
                    console.error("❌ Join room error:", joinResult.error);
                    return;
                }

                console.log("✅ Joined room successfully");

                // Initialize MediaSoup device
                const device = new Device();
                await device.load({ routerRtpCapabilities: joinResult.routerRtpCapabilities });
                deviceRef.current = device;

                // Start producing
                await produce(stream);

                // Consume existing producers
                if (joinResult.producersToConsume) {
                    for (const producer of joinResult.producersToConsume) {
                        await consume(producer.producerId, producer.userName, producer.remotePeerSocketId);
                    }
                }

                setIsInitialized(true);
                console.log("🎉 MediaSoup initialization complete");

            } catch (error) { 
                console.error("💥 Initialization Error:", error); 
            }
        };

        if (socket && roomId && !isInitialized) {
            init();
        }
    }, [socket, roomId, produce, consume, getUserInfo, isInitialized]);

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        const handleNewProducer = ({ producerId, userName, remotePeerSocketId }) => { 
            console.log("👥 New producer:", userName);
            consume(producerId, userName, remotePeerSocketId); 
        };

        const handleProducerClosed = ({ producerId }) => {
            console.log("🚪 Producer closed:", producerId);
            setRemoteStreams(prev => {
                const newState = { ...prev };
                let peerIdToRemove = null;
                for (const peerId in newState) {
                    const peer = newState[peerId];
                    for (const consumer of peer.consumers.values()) {
                        if (consumer.producerId === producerId) {
                            peerIdToRemove = peerId;
                            break;
                        }
                    }
                    if (peerIdToRemove) break;
                }
                if (peerIdToRemove) {
                    const transportData = consumerTransportsRef.current[peerIdToRemove];
                    if (transportData) {
                        transportData.transport.close();
                        delete consumerTransportsRef.current[peerIdToRemove];
                    }
                    delete newState[peerIdToRemove];
                }
                return newState;
            });
        };

        const handleRemoteProducerState = ({ remotePeerSocketId, kind, paused }) => {
            console.log("🔄 Remote producer state change:", remotePeerSocketId, kind, paused);
            setRemoteStreams(prev => {
                const peerData = prev[remotePeerSocketId];
                if (!peerData) return prev;

                const updatedPeerData = { ...peerData };
                updatedPeerData.isVideoOff = kind === 'video' ? paused : peerData.isVideoOff;
                updatedPeerData.isAudioMuted = kind === 'audio' ? paused : peerData.isAudioMuted;
                
                if (kind === 'video') {
                    const audioConsumer = updatedPeerData.consumers.get('audio');
                    const videoConsumer = updatedPeerData.consumers.get('video');
                    const tracks = [];

                    if (audioConsumer) {
                        tracks.push(audioConsumer.track);
                    }
                    if (videoConsumer && !paused) {
                        tracks.push(videoConsumer.track);
                    }
                    
                    updatedPeerData.combinedStream = new MediaStream(tracks);
                }
                
                return { ...prev, [remotePeerSocketId]: updatedPeerData };
            });
        };

        // Handle approval for users
        const handleJoinApproved = async ({ routerRtpCapabilities }) => {
            console.log("✅ Join request approved, initializing MediaSoup...");
            
            try {
                // Initialize device if not done already
                if (!deviceRef.current) {
                    const device = new Device();
                    await device.load({ routerRtpCapabilities });
                    deviceRef.current = device;
                }

                // Get media stream if not available
                if (!localStream) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    localAudioTrackRef.current = stream.getAudioTracks()[0];
                    localVideoTrackRef.current = stream.getVideoTracks()[0];
                    setLocalStream(stream);
                    
                    // Start producing
                    await produce(stream);
                } else {
                    // Start producing with existing stream
                    await produce(localStream);
                }

                setIsInitialized(true);
                console.log("🎉 MediaSoup initialized after approval");

            } catch (error) {
                console.error("💥 Error initializing after approval:", error);
            }
        };

        socket.on('newProducer', handleNewProducer);
        socket.on('producerClosed', handleProducerClosed);
        socket.on('remoteProducerStateChanged', handleRemoteProducerState);
        socket.on('joinApproved', handleJoinApproved);

        return () => {
            socket.off('newProducer', handleNewProducer);
            socket.off('producerClosed', handleProducerClosed);
            socket.off('remoteProducerStateChanged', handleRemoteProducerState);
            socket.off('joinApproved', handleJoinApproved);
        };
    }, [socket, consume, produce, localStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            producerTransportRef.current?.close();
            Object.values(consumerTransportsRef.current).forEach(t => t.transport?.close());
            localStream?.getTracks().forEach(track => track.stop());
        };
    }, [localStream]);

    const toggleAudio = useCallback(() => {
        if (!audioProducerRef.current) return false;
        
        const isPaused = !audioProducerRef.current.paused;
        
        if (isPaused) {
            audioProducerRef.current.pause();
        } else {
            audioProducerRef.current.resume();
        }
        
        if (socket) {
            socket.emit('producerStateChanged', { kind: 'audio', paused: isPaused });
        }
        
        return isPaused;
    }, [socket]);

    const toggleVideo = useCallback(async () => {
        if (!videoProducerRef.current) return false;
        
        const isPaused = !videoProducerRef.current.paused;

        try {
            if (isPaused) {
                // Pause video
                videoProducerRef.current.pause();
                localVideoTrackRef.current?.stop();
            } else {
                // Resume video - get new video stream
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = newStream.getVideoTracks()[0];
                localVideoTrackRef.current = newTrack;
                
                // Replace track in producer
                await videoProducerRef.current.replaceTrack({ track: newTrack });
                videoProducerRef.current.resume();
            }
            
            if (socket) {
                socket.emit('producerStateChanged', { kind: 'video', paused: isPaused });
            }
            
            // Update local stream
            const newLocalStream = new MediaStream([localAudioTrackRef.current]);
            if (!isPaused && localVideoTrackRef.current) {
                newLocalStream.addTrack(localVideoTrackRef.current);
            }
            setLocalStream(newLocalStream);
            
            return isPaused;
        } catch (error) {
            console.error("Error toggling video:", error);
            return videoProducerRef.current.paused;
        }
    }, [socket]);

    return { 
        localStream, 
        remoteStreams, 
        toggleAudio, 
        toggleVideo,
        isInitialized 
    };
};