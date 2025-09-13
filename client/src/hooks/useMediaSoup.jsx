import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { useSocket } from '@/lib/socket.jsx';

export const useMediasoup = () => {
    const { roomId } = useParams();
    const socket = useSocket();

    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    
    const localAudioTrackRef = useRef(null);
    const localVideoTrackRef = useRef(null); 
    
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const audioProducerRef = useRef(null);
    const videoProducerRef = useRef(null);
    const consumerTransportsRef = useRef({});

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

            if (stream.getAudioTracks()[0]) audioProducerRef.current = await transport.produce({ track: stream.getAudioTracks()[0] });
            if (stream.getVideoTracks()[0]) videoProducerRef.current = await transport.produce({ track: stream.getVideoTracks()[0] });
        } catch (error) { console.error("Error in produce():", error); }
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
        } catch (error) { console.error("Error in consume():", error); }
    }, [socket]);
    
    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localAudioTrackRef.current = stream.getAudioTracks()[0];
                localVideoTrackRef.current = stream.getVideoTracks()[0];
                setLocalStream(stream);
                const { routerRtpCapabilities, producersToConsume } = await socket.emitWithAck('joinRoom', { userName: `User-${socket.id.slice(0, 4)}`, roomName: roomId });
                const device = new Device();
                await device.load({ routerRtpCapabilities });
                deviceRef.current = device;
                await produce(stream);
                for (const producer of producersToConsume) {
                    await consume(producer.producerId, producer.userName, producer.remotePeerSocketId);
                }
            } catch (error) { console.error("Initialization Error:", error); }
        };
        if (socket && roomId) init();

        const handleNewProducer = ({ producerId, userName, remotePeerSocketId }) => { consume(producerId, userName, remotePeerSocketId); };
        const handleProducerClosed = ({ producerId }) => {
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

        // --- THIS IS THE CORRECTED HANDLER ---
        const handleRemoteProducerState = ({ remotePeerSocketId, kind, paused }) => {
            setRemoteStreams(prev => {
                const peerData = prev[remotePeerSocketId];
                if (!peerData) return prev;

                // Create a mutable copy to work with
                const updatedPeerData = { ...peerData };
                updatedPeerData.isVideoOff = kind === 'video' ? paused : peerData.isVideoOff;
                updatedPeerData.isAudioMuted = kind === 'audio' ? paused : peerData.isAudioMuted;
                
                // If a video track state has changed, we MUST rebuild the combined stream
                if (kind === 'video') {
                    const audioConsumer = updatedPeerData.consumers.get('audio');
                    const videoConsumer = updatedPeerData.consumers.get('video');
                    const tracks = [];

                    if (audioConsumer) {
                        tracks.push(audioConsumer.track);
                    }
                    // Only add the video track if it's not paused. The consumer's track
                    // will be the NEW, LIVE track after a `replaceTrack` operation.
                    if (videoConsumer && !paused) {
                        tracks.push(videoConsumer.track);
                    }
                    
                    // Create a BRAND NEW MediaStream object. This is the key to forcing React
                    // to update the <video> element's srcObject.
                    updatedPeerData.combinedStream = new MediaStream(tracks);
                }
                
                return { ...prev, [remotePeerSocketId]: updatedPeerData };
            });
        };
        // --- END OF CORRECTION ---

        socket.on('newProducer', handleNewProducer);
        socket.on('producerClosed', handleProducerClosed);
        socket.on('remoteProducerStateChanged', handleRemoteProducerState);

        return () => {
            socket.off('newProducer', handleNewProducer);
            socket.off('producerClosed', handleProducerClosed);
            socket.off('remoteProducerStateChanged', handleRemoteProducerState);
            producerTransportRef.current?.close();
            Object.values(consumerTransportsRef.current).forEach(t => t.transport?.close());
            localStream?.getTracks().forEach(track => track.stop());
        };
    }, [socket, roomId, produce, consume]);

    const toggleAudio = useCallback(() => {
        if (!audioProducerRef.current) return false;
        const isPaused = !audioProducerRef.current.paused;
        if (isPaused) audioProducerRef.current.pause();
        else audioProducerRef.current.resume();
        socket.emit('producerStateChanged', { kind: 'audio', paused: isPaused });
        return isPaused;
    }, [socket]);

    const toggleVideo = useCallback(async () => {
        if (!videoProducerRef.current) return false;
        const isPaused = !videoProducerRef.current.paused;

        if (isPaused) {
            videoProducerRef.current.pause();
            localVideoTrackRef.current?.stop();
        } else {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = newStream.getVideoTracks()[0];
            localVideoTrackRef.current = newTrack;
            await videoProducerRef.current.replaceTrack({ track: newTrack });
            videoProducerRef.current.resume();
        }
        
        socket.emit('producerStateChanged', { kind: 'video', paused: isPaused });
        
        const newLocalStream = new MediaStream([localAudioTrackRef.current]);
        if (!isPaused && localVideoTrackRef.current) newLocalStream.addTrack(localVideoTrackRef.current);
        setLocalStream(newLocalStream);
        
        return isPaused;
    }, [socket]);

    return { localStream, remoteStreams, toggleAudio, toggleVideo };
};