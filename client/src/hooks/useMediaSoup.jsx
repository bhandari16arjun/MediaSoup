// src/hooks/useMediasoup.jsx
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
  const [isAdmin, setIsAdmin] = useState(false);

  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);
  const consumerTransportsRef = useRef({}); // remotePeerSocketId -> { transport, consumers: Map }

  const getUserInfo = useCallback(() => {
    const adminInfo = localStorage.getItem('meetingAdmin');
    const userInfo = localStorage.getItem('meetingUser');
    if (adminInfo) return JSON.parse(adminInfo);
    if (userInfo) return JSON.parse(userInfo);
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

      // produce audio and video if present
      const a = stream.getAudioTracks();
      const v = stream.getVideoTracks();
      if (a) audioProducerRef.current = await transport.produce({ track: a });
      if (v) videoProducerRef.current = await transport.produce({ track: v });
    } catch (error) {
      console.error('Error in produce():', error);
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
          socket.emitWithAck('connectTransport', { transportId: transport.id, dtlsParameters })
            .then(callback)
            .catch(errback);
        });
        transportData = { transport, consumers: new Map() };
        consumerTransportsRef.current[remotePeerSocketId] = transportData;
      }

      const consumerParams = await socket.emitWithAck('consume', {
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        producerId,
        remotePeerSocketId
      });
      if (consumerParams.error) throw new Error(consumerParams.error);

      const consumer = await transportData.transport.consume(consumerParams);
      transportData.consumers.set(consumer.id, consumer);

      await socket.emitWithAck('resumeConsumer', { consumerId: consumer.id, remotePeerSocketId });

      setRemoteStreams(prev => {
        const existingPeer = prev[remotePeerSocketId] || {
          userName,
          streams: new Map(),
          consumers: new Map(),
          isAudioMuted: false,
          isVideoOff: false
        };
        existingPeer.streams.set(consumer.kind, new MediaStream([consumer.track]));
        existingPeer.consumers.set(consumer.kind, consumer);
        return {
          ...prev,
          [remotePeerSocketId]: {
            ...existingPeer,
            combinedStream: new MediaStream(
              [...existingPeer.streams.values()].flatMap(s => s.getTracks())
            ),
          }
        };
      });
    } catch (error) {
      console.error('Error in consume():', error);
    }
  }, [socket]);

  useEffect(() => {
    const init = async () => {
      try {
        const userInfo = getUserInfo();
        if (!userInfo || !socket || !roomId) return;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localAudioTrackRef.current = stream.getAudioTracks();
        localVideoTrackRef.current = stream.getVideoTracks();
        setLocalStream(stream);

        const joinResult = await socket.emitWithAck('joinRoom', {
          userName: userInfo.userName,
          roomName: roomId
        });

        if (joinResult.waitingForApproval) {
          return;
        }
        if (joinResult.error) {
          console.error('❌ Join room error:', joinResult.error);
          return;
        }

        setIsAdmin(!!joinResult.isAdmin);
        if (joinResult.isAdmin) {
          localStorage.setItem('meetingAdmin', JSON.stringify({ ...userInfo, isAdmin: true }));
          localStorage.removeItem('meetingUser');
        }

        const device = new Device();
        await device.load({ routerRtpCapabilities: joinResult.routerRtpCapabilities });
        deviceRef.current = device;

        await produce(stream);

        if (joinResult.producersToConsume) {
          for (const producer of joinResult.producersToConsume) {
            await consume(producer.producerId, producer.userName, producer.remotePeerSocketId);
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('💥 Initialization Error:', error);
      }
    };
    if (socket && roomId && !isInitialized) init();
  }, [socket, roomId, produce, consume, getUserInfo, isInitialized]);

  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = ({ producerId, userName, remotePeerSocketId }) => {
      consume(producerId, userName, remotePeerSocketId);
    };

    const handleProducerClosed = ({ producerId }) => {
      setRemoteStreams(prev => {
        const newState = { ...prev };
        let peerIdToRemove = null;
        for (const peerId in newState) {
          const peer = newState[peerId];
          for (const c of peer.consumers.values()) {
            if (c.producerId === producerId) { peerIdToRemove = peerId; break; }
          }
          if (peerIdToRemove) break;
        }
        if (peerIdToRemove) {
          const t = consumerTransportsRef.current[peerIdToRemove];
          if (t) {
            t.transport.close();
            delete consumerTransportsRef.current[peerIdToRemove];
          }
          delete newState[peerIdToRemove];
        }
        return newState;
      });
    };

    const handleRemoteProducerState = ({ remotePeerSocketId, kind, paused }) => {
      setRemoteStreams(prev => {
        const peerData = prev[remotePeerSocketId];
        if (!peerData) return prev;
        const updated = { ...peerData };
        updated.isVideoOff = kind === 'video' ? paused : peerData.isVideoOff;
        updated.isAudioMuted = kind === 'audio' ? paused : peerData.isAudioMuted;

        if (kind === 'video') {
          const audioConsumer = updated.consumers.get('audio');
          const videoConsumer = updated.consumers.get('video');
          const tracks = [];
          if (audioConsumer) tracks.push(audioConsumer.track);
          if (videoConsumer && !paused) tracks.push(videoConsumer.track);
          updated.combinedStream = new MediaStream(tracks);
        }
        return { ...prev, [remotePeerSocketId]: updated };
      });
    };

    const handleJoinApproved = async ({ routerRtpCapabilities, producersToConsume = [] }) => {
      try {
        if (!deviceRef.current) {
          const device = new Device();
          await device.load({ routerRtpCapabilities });
          deviceRef.current = device;
        }
        if (!localStream) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localAudioTrackRef.current = stream.getAudioTracks();
          localVideoTrackRef.current = stream.getVideoTracks();
          setLocalStream(stream);
          await produce(stream);
        } else {
          await produce(localStream);
        }

        for (const p of producersToConsume) {
          await consume(p.producerId, p.userName, p.remotePeerSocketId);
        }
        setIsInitialized(true);
      } catch (e) {
        console.error('💥 Error initializing after approval:', e);
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
    if (isPaused) audioProducerRef.current.pause();
    else audioProducerRef.current.resume();
    socket?.emit('producerStateChanged', { kind: 'audio', paused: isPaused });
    return isPaused;
  }, [socket]);

  const toggleVideo = useCallback(async () => {
    if (!videoProducerRef.current) return false;
    const isPaused = !videoProducerRef.current.paused;
    try {
      if (isPaused) {
        videoProducerRef.current.pause();
        // stopping track is OK since we replace on resume
        localVideoTrackRef.current?.stop();
      } else {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks();
        localVideoTrackRef.current = newTrack;
        await videoProducerRef.current.replaceTrack({ track: newTrack });
        videoProducerRef.current.resume();
      }
      socket?.emit('producerStateChanged', { kind: 'video', paused: isPaused });

      const newLocal = new MediaStream([localAudioTrackRef.current].filter(Boolean));
      if (!isPaused && localVideoTrackRef.current) newLocal.addTrack(localVideoTrackRef.current);
      setLocalStream(newLocal);
      return isPaused;
    } catch (e) {
      console.error('Error toggling video:', e);
      return videoProducerRef.current.paused;
    }
  }, [socket]);

  return {
    localStream,
    remoteStreams,
    toggleAudio,
    toggleVideo,
    isInitialized,
    isAdmin,
  };
};
