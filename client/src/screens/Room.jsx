import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider';
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaComments,
  FaSignOutAlt,
} from 'react-icons/fa';
import './Room.css';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function Room() {
  const { roomId } = useParams();
  const email = useLocation().state?.email;
  const navigate = useNavigate();
  const socket = useSocket();

  const localStream = useRef(null);
  const peersRef = useRef({});
  const chatInputRef = useRef();

  const [peers, setPeers] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (!email) return navigate('/');
    if (!socket) return;

    socket.emit('room:join', { email, room: roomId });

    socket.on('room-users', async users => {
      const others = users.filter(u => u.id !== socket.id);

      if (!localStream.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStream.current = stream;
        } catch {
          alert('Failed to access camera/mic.');
          return;
        }
      }

      others.forEach(user => {
        if (!peersRef.current[user.id]) {
          createPeerConnection(user.id, true);
        }
      });

      Object.keys(peersRef.current).forEach(peerId => {
        if (!users.find(u => u.id === peerId)) {
          peersRef.current[peerId].close();
          delete peersRef.current[peerId];
          setPeers(prev => prev.filter(p => p.id !== peerId));
        }
      });

      setInCall(true);
    });

    socket.on('webrtc-offer', async ({ from, offer }) => {
      if (!localStream.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
      }
      await handleOffer(from, offer);
    });

    socket.on('webrtc-answer', async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Failed to set remote answer:", err);
        }
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('ICE Error:', e);
        }
      }
    });

    socket.on('chat-message', ({ fromEmail, message }) => {
      setChatMessages(prev => [...prev, { fromEmail, message }]);
    });

    socket.on('user-left', id => {
      if (peersRef.current[id]) {
        peersRef.current[id].close();
        delete peersRef.current[id];
        setPeers(prev => prev.filter(p => p.id !== id));
      }
    });

    socket.on('reaction', ({ peerId, emoji }) => {
      const id = Date.now();
      setReactions(prev => [...prev, { id, emoji, peerId }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 1000);
    });

    return () => {
      socket.emit('leave-room', { room: roomId });
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      localStream.current?.getTracks().forEach(t => t.stop());
      setPeers([]);
      setInCall(false);
      setChatMessages([]);
      socket.off();
    };
  }, [socket, email, roomId, navigate]);

  async function createPeerConnection(peerId, amCaller) {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peersRef.current[peerId] = pc;

    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    pc.ontrack = e => {
      setPeers(prev => {
        const exists = prev.find(p => p.id === peerId);
        if (exists) {
          return prev.map(p => (p.id === peerId ? { ...p, stream: e.streams[0] } : p));
        } else {
          return [...prev, { id: peerId, stream: e.streams[0] }];
        }
      });
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { to: peerId, candidate: e.candidate });
      }
    };

    if (amCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { to: peerId, offer });
    }

    return pc;
  }

  async function handleOffer(fromId, offer) {
    const pc = await createPeerConnection(fromId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer', { to: fromId, answer });
  }

  function toggleVideo() {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
    }
  }

  function toggleAudio() {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
    }
  }

  function leaveRoom() {
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    localStream.current?.getTracks().forEach(t => t.stop());
    socket.emit('leave-room', { room: roomId });
    navigate('/');
  }

  function sendChatMessage(e) {
    e.preventDefault();
    const message = chatInputRef.current.value.trim();
    if (message.length === 0) return;
    socket.emit('chat-message', { room: roomId, message });
    setChatMessages(prev => [...prev, { fromEmail: email, message }]);
    chatInputRef.current.value = '';
  }

  function sendReaction(emoji) {
    const id = Date.now();
    socket.emit('reaction', { room: roomId, emoji });
    setReactions(prev => [...prev, { id, emoji, peerId: socket.id }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 1000);
  }

  return (
    <div className="room-wrapper">
      <header className="room-header">
        <h2>Meeting: {roomId}</h2>
        <button className="btn leave-btn" onClick={leaveRoom}>
          <FaSignOutAlt /> Leave
        </button>
      </header>

      <div className="room-main">
        <div className="videos-container">
          <div className="video-box">
            <video
              className="video-player"
              autoPlay
              muted
              playsInline
              ref={video => {
                if (video && localStream.current && video.srcObject !== localStream.current) {
                  video.srcObject = localStream.current;
                }
              }}
            />
            {reactions.filter(r => r.peerId === socket.id).map(r => (
              <div key={r.id} className="reaction">{r.emoji}</div>
            ))}
          </div>

          {peers.map(({ id, stream }) => (
            <div className="video-box" key={id}>
              <video
                className="video-player"
                autoPlay
                playsInline
                ref={video => {
                  if (video && stream && video.srcObject !== stream) {
                    video.srcObject = stream;
                  }
                }}
              />
              {reactions.filter(r => r.peerId === id).map(r => (
                <div key={r.id} className="reaction">{r.emoji}</div>
              ))}
            </div>
          ))}
        </div>

        {showChat && (
          <div className="chat-sidebar">
            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-message ${msg.fromEmail === email ? 'own-message' : ''}`}
                >
                  <strong>{msg.fromEmail === email ? 'You' : msg.fromEmail}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="chat-input-form">
              <input type="text" placeholder="Type a message..." ref={chatInputRef} />
              <button type="submit">Send</button>
            </form>
          </div>
        )}
      </div>

      <footer className="room-controls">
        <button className="btn toggle-btn" onClick={toggleAudio}>
          {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          {audioEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button className="btn toggle-btn" onClick={toggleVideo}>
          {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
          {videoEnabled ? 'Video Off' : 'Video On'}
        </button>
        <button className="btn toggle-btn" onClick={() => setShowChat(!showChat)}>
          <FaComments /> Chat
        </button>
        <button className="btn leave-btn" onClick={leaveRoom}>
          <FaPhoneSlash /> Leave
        </button>

        <div className="emoji-controls">
          {['👍', '❤️', '😂', '🎉', '🔥'].map(emoji => (
            <button key={emoji} className="emoji-btn" onClick={() => sendReaction(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}