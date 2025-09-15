// server/config/config.js
const config = {
  port: 3034,
  workerSettings: {
    rtcMinPort: 40000,
    rtcMaxPort: 41000,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  routerMediaCodecs: [
    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
    {
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
      },
    },
    { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: {} },
  ],
  webRtcTransport: {
    // For mediasoup v3, listenIps or listenInfos are accepted here.
    listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 5_000_000,
    // Optionally set per-transport:
    // maxIncomingBitrate: 5_000_000,
  },
};
module.exports = config;
