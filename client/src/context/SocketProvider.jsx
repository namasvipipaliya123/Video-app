import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const s = io('http://localhost:8000');
    setSocket(s);
    return () => s.disconnect();
  }, []);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};
