import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lobby.css';

const Lobby = () => {
  const [email, setEmail] = useState('');
  const [room, setRoom] = useState('');
  const navigate = useNavigate();

  const join = () => {
    if (!email || !room) return alert('Email & Room ID required');
    navigate(`/room/${room}`, { state: { email } });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h2>Joining Room</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Room ID"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <button onClick={join}>Join Room</button>
      </div>
    </div>
  );
};

export default Lobby;