import { useState, useRef, useEffect } from "react";
import { convertToWav } from "../utils/audioUtils";
import WaveSurfer from "wavesurfer.js";

export default function AudioRecorder({ onRecordingComplete }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start audio level monitoring
  const startAudioMonitoring = () => {
    if (!streamRef.current) return;
    
    try {
      // Create audio context and analyser
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Get audio stream source
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Update audio levels
      const updateLevels = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Normalize to 0-1 range
        const normalized = average / 255;
        setAudioLevel(normalized);
        
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      
      updateLevels();
    } catch (err) {
      console.warn("Could not initialize audio monitoring:", err);
    }
  };

  // Stop audio level monitoring
  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
  };

  // Check supported MIME types
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (let type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    // Fallback to default
    return '';
  };

  // Start recording
 const startRecording = async () => {
  try {
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    setPermissionDenied(false);
    setRecording(true);
    setPaused(false);
    audioChunksRef.current = [];

    const mimeType = "audio/webm;codecs=opus";

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mimeType,
      });

      setRecordedBlob(audioBlob);
      onRecordingComplete?.(audioBlob);
      stopAudioMonitoring();
    };

    mediaRecorder.start();
    startTimer();
    startAudioMonitoring();
  } catch (err) {
    console.error("Mic error:", err);
    setPermissionDenied(true);
    setRecording(false);
  }
};


  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setPaused(true);
      stopTimer();
      stopAudioMonitoring();
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setPaused(false);
      startTimer();
      startAudioMonitoring();
    }
  };

  // Stop recording
 const stopRecording = () => {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop();
  }

  setRecording(false);
  setPaused(false);
  stopTimer();
  stopAudioMonitoring();

  setTimeout(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, 300); // allow buffer flush
};


  // Start timer
  const startTimer = () => {
    stopTimer(); // Clear any existing timer
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  // Stop timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset recording
  const resetRecording = () => {
    setRecordedBlob(null);
    setTimer(0);
    setAudioLevel(0);
    if (onRecordingComplete) {
      onRecordingComplete(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopAudioMonitoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="audio-recorder">
      <h3>🎙️ Record Audio</h3>
      
      {permissionDenied && (
        <div className="error-message">
          Microphone permission denied. Please allow microphone access to record audio.
        </div>
      )}

      <div className="recorder-display">
        <div className={`recording-indicator ${recording && !paused ? 'recording' : ''}`}>
          <span className="timer">{formatTime(timer)}</span>
        </div>
        
        {/* Audio level visualization during recording */}
        {recording && !paused && (
          <div className="audio-levels">
            <div className="levels-container">
              {[...Array(20)].map((_, i) => (
                <div 
                  key={i} 
                  className="level-bar"
                  style={{
                    height: `${Math.max(5, audioLevel * 100 * (0.7 + 0.3 * Math.random()))}%`,
                    backgroundColor: `rgba(79, 95, 220, ${0.5 + audioLevel * 0.5})`
                  }}
                />
              ))}
            </div>
            <div className="levels-label">Listening...</div>
          </div>
        )}
        
        {!recordedBlob ? (
          <div className="recorder-controls">
            {!recording ? (
              <button 
                className="record-btn start" 
                onClick={startRecording}
                disabled={permissionDenied}
              >
                ● Start Recording
              </button>
            ) : (
              <>
                {paused ? (
                  <button 
                    className="record-btn resume" 
                    onClick={resumeRecording}
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button 
                    className="record-btn pause" 
                    onClick={pauseRecording}
                  >
                    ❙❙ Pause
                  </button>
                )}
                <button 
                  className="record-btn stop" 
                  onClick={stopRecording}
                >
                  ■ Stop
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="recording-preview">
            <div className="preview-info">
              <span className="file-name">Recorded Audio</span>
              <span className="file-duration">{formatTime(timer)}</span>
            </div>
            
            <div className="preview-controls">
              <button 
                className="preview-btn download" 
                onClick={() => {
                  if (recordedBlob) {
                    const audioUrl = URL.createObjectURL(recordedBlob);
                    const a = document.createElement('a');
                    a.href = audioUrl;
                    a.download = `recorded-audio-${new Date().getTime()}.wav`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(audioUrl);
                  }
                }}
              >
                ↓ Download
              </button>
              
              <button 
                className="preview-btn reset" 
                onClick={resetRecording}
              >
                🗑 Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
