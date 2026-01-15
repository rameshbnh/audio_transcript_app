import { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

export default function MediaPlayer({ audioSource, fileName }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [showPlayer, setShowPlayer] = useState(false); // Only show when audio source is available
  const [waveformReady, setWaveformReady] = useState(false); // Track waveform readiness
  const [isScrolling, setIsScrolling] = useState(false); // Track scrolling state
  const [shouldHideOnScroll, setShouldHideOnScroll] = useState(false); // Only hide when results are present
  
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  
  // Track the current audio source to prevent unnecessary re-initialization
  const currentAudioSourceRef = useRef(audioSource);

  // Initialize waveform
  useEffect(() => {
    // Check if we're dealing with the same audio source
    const isSameSource = (() => {
      // Both are null/undefined
      if (!audioSource && !currentAudioSourceRef.current) return true;
      
      // One is null/undefined, the other isn't
      if (!audioSource || !currentAudioSourceRef.current) return false;
      
      // For strings (URLs), direct comparison
      if (typeof audioSource === 'string' && typeof currentAudioSourceRef.current === 'string') {
        return audioSource === currentAudioSourceRef.current;
      }
      
      // For Files/Blobs, compare by reference first
      if (audioSource === currentAudioSourceRef.current) return true;
      
      // For Files, compare by name, size, and lastModified
      if (audioSource instanceof File && currentAudioSourceRef.current instanceof File) {
        return audioSource.name === currentAudioSourceRef.current.name &&
               audioSource.size === currentAudioSourceRef.current.size &&
               audioSource.lastModified === currentAudioSourceRef.current.lastModified;
      }
      
      // For Blobs, compare by size and type
      if (audioSource instanceof Blob && currentAudioSourceRef.current instanceof Blob) {
        return audioSource.size === currentAudioSourceRef.current.size && 
               audioSource.type === currentAudioSourceRef.current.type;
      }
      
      return false;
    })();

    // Only re-initialize if we have a different audio source
    if (audioSource && waveformRef.current && !isSameSource) {
      // Update the ref
      currentAudioSourceRef.current = audioSource;
      
      // Clean up previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      
      // Create new WaveSurfer instance
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#667eea',
        progressColor: '#764ba2',
        cursorColor: '#4f5fdc',
        barWidth: 2,
        barRadius: 2,
        barGap: 1,
        height: 60,
        responsive: true,
        normalize: true,
        partialRender: true,
        hideScrollbar: true,
      });
      
      // Load audio
      if (typeof audioSource === 'string') {
        // Uploaded file URL
        wavesurferRef.current.load(audioSource);
      } else if (audioSource instanceof Blob) {
        // Recorded audio blob or File
        const objectUrl = URL.createObjectURL(audioSource);
        wavesurferRef.current.load(objectUrl);
      }
      
      // Event listeners
      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current.getDuration());
        setWaveformReady(true);
      });
      
      wavesurferRef.current.on('audioprocess', () => {
        setCurrentTime(wavesurferRef.current.getCurrentTime());
      });
      
      wavesurferRef.current.on('seek', () => {
        setCurrentTime(wavesurferRef.current.getCurrentTime());
      });
      
      wavesurferRef.current.on('finish', () => {
        setIsPlaying(false);
      });
      
      // Click to seek
      wavesurferRef.current.on('interaction', (newTime) => {
        wavesurferRef.current.setCurrentTime(newTime);
        setCurrentTime(newTime);
      });
    }
    
    // Reset states when audio source changes to null
    if (!audioSource && currentAudioSourceRef.current) {
      // Update the ref
      currentAudioSourceRef.current = null;
      
      // Clean up previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      
      setShowPlayer(false);
      setWaveformReady(false);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
    
    return () => {
      // Only revoke object URLs for blobs/files
      if (currentAudioSourceRef.current instanceof Blob) {
        URL.revokeObjectURL(currentAudioSourceRef.current);
      }
    };
  }, [audioSource]);
  
  // Check if results are present (to determine if we should hide on scroll)
  useEffect(() => {
    const checkForResults = () => {
      const resultBox = document.querySelector('.result-box');
      setShouldHideOnScroll(!!resultBox);
    };
    
    // Check initially
    checkForResults();
    
    // Create a MutationObserver to watch for changes in the DOM
    const observer = new MutationObserver(checkForResults);
    
    // Observe changes in the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Clean up the observer on component unmount
    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Add scroll event listener to hide player when scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Only hide if results are present on the screen
      if (!shouldHideOnScroll) return;
      
      setIsScrolling(true);
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set a timeout to reset the scrolling state after 1 second of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        // Check if we've reached the end of the page
        const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 5;
        
        // Only reset scrolling state if we're not at the bottom
        if (!isAtBottom) {
          setIsScrolling(false);
        }
      }, 1000);
    };
    
    // Add scroll event listener to the window
    window.addEventListener('scroll', handleScroll);
    
    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [shouldHideOnScroll]);
  
  // Play/Pause control
  const togglePlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };
  
  // Stop playback
  const stopPlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
    }
  };
  
  // Format time (seconds to MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle seek
  const handleSeek = (e) => {
    if (wavesurferRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * duration;
      wavesurferRef.current.seekTo(pos);
      setCurrentTime(newTime);
    }
  };
  
  // Don't show player if there's no audio source
  if (!audioSource) {
    return null;
  }
  
  return (
    <div className={`media-player ${isScrolling ? 'scrolling' : ''}`}>
      <div className="player-header">
        <span className="file-name">{fileName || 'Audio File'}</span>
        <button className="close-btn" onClick={() => setShowPlayer(false)}>×</button>
      </div>
      
      <div className="waveform-container" ref={waveformRef}>
        {!waveformReady && (
          <div className="waveform-placeholder">
            Detecting waveform...
          </div>
        )}
      </div>
      
      <div className="player-controls">
        <button className="control-btn" onClick={togglePlayback} disabled={!waveformReady}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        
        <button className="control-btn" onClick={stopPlayback} disabled={!waveformReady}>
          ⬛
        </button>
        
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div className="volume-control">
          <span className="volume-icon">🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
            disabled={!waveformReady}
          />
        </div>
      </div>
    </div>
  );
}
