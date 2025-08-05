import React, { forwardRef } from 'react';

const VideoPlayer = forwardRef(({ label }, ref) => (
  <div style={{ margin: 10 }}>
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={label === 'You'}
      style={{ width: 320, height: 240, backgroundColor: '#000' }}
    />
    <p>{label}</p>
  </div>
));

export default VideoPlayer;
