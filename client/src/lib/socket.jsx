import React, { createContext, useContext } from 'react';
import { io } from 'socket.io-client';

// Connect to your Node.js backend server
const socket = io('http://localhost:3033');

// Add connection debugging
socket.on('connect', () => {
  console.log('🔌 Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('🔌 Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('🔌 Socket connection error:', error);
}); 

const SocketContext = createContext(socket);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};