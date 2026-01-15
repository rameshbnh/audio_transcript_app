import { useState, useRef } from "react";
import { uploadAudio } from "../api";
import AudioRecorder from "./AudioRecorder";

export default function UploadForm({ onModeChange, onResult, onFileSelect, onRecordingComplete, currentAudioFile }) {
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingMode, setProcessingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'record'
  const [recordedAudio, setRecordedAudio] = useState(null); // Store recorded audio
  const fileInputRef = useRef(null);

  async function handleSubmit(selectedMode) {
    // First check if we have a recorded audio file
    let file = recordedAudio;
    
    // If no recorded audio, try to get from file input
    if (!file) {
      file = fileInputRef.current?.files[0];
    }
    
    if (!file) {
      console.log("FRONTEND LOG: No file selected for upload", {
        timestamp: new Date().toISOString()
      });
      alert("Please select an audio file");
      return;
    }

    console.log("FRONTEND LOG: Upload form submitted", {
      filename: file.name,
      size: file.size,
      mode: selectedMode,
      timestamp: new Date().toISOString()
    });

    onResult(null);
    setProcessingMode(selectedMode);
    setLoading(true);
    onModeChange(selectedMode);

    try {
      const data = await uploadAudio(file, selectedMode);
      console.log("FRONTEND LOG: Upload completed successfully", {
        filename: file.name,
        mode: selectedMode,
        result_size: JSON.stringify(data).length,
        timestamp: new Date().toISOString()
      });
      onResult(data);
    } catch (err) {
      console.error("FRONTEND LOG: Upload failed", {
        error: err.message,
        filename: file.name,
        mode: selectedMode,
        timestamp: new Date().toISOString()
      });
      alert(err.message);
      onResult(null);
    }

    setLoading(false);
    setProcessingMode(null);
  }

  // Handle file selection for upload tab
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check if this is the same file as already loaded
      if (currentAudioFile && 
          selectedFile.name === currentAudioFile.name && 
          selectedFile.size === currentAudioFile.size && 
          selectedFile.lastModified === currentAudioFile.lastModified) {
        // Same file, no need to update
        setFileName(selectedFile.name);
        return;
      }
      
      setFileName(selectedFile.name);
      onFileSelect(selectedFile); // Pass file to parent component
    } else {
      setFileName("");
      onFileSelect(null); // Clear file in parent component
    }
  };
  
  // Handle recorded audio blob
  const handleRecordingComplete = (blob) => {
    if (blob) {
      // Since we're converting to WAV, we'll always use WAV extension
      const recordedFile = new File([blob], "recorded_audio.wav", {
        type: "audio/wav",
        lastModified: Date.now(),
      });
      setFileName("Recorded Audio (.wav)");
      setRecordedAudio(recordedFile); // Store for immediate processing
      onRecordingComplete(blob); // Pass blob to parent component
      onFileSelect(recordedFile); // Also pass the file version
    } else {
      // Reset if recording was discarded
      setFileName("");
      setRecordedAudio(null); // Clear recorded audio
      onRecordingComplete(null); // Clear blob in parent component
      onFileSelect(null); // Clear file in parent component
    }
  };

  return (
    <div className="card">
      <h2>🎧 Audio Gateway</h2>
      
      {/* Tab navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('upload');
            // Clear recorded audio when switching to upload tab
            setRecordedAudio(null);
          }}
        >
          Upload File
        </button>
        <button 
          className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('record');
            // Clear file input when switching to record tab
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setFileName('');
          }}
        >
          Record Audio
        </button>
      </div>

      {activeTab === 'upload' ? (
        <>
          <div
            className="upload-box"
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                // Simulate file input change event
                const event = { target: { files } };
                handleFileSelect(event);
              }
            }}
          >
            <div className="file-row">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM14 8V3.5L18.5 8H14Z"
                  fill="#4f5fdc"
                />
              </svg>

              <span className="file-name">
                {fileName || "Choose Audio File"}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              hidden
            />
          </div>
        </>
      ) : (
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      )}

      <div className="button-group">
        <button
          className="action-btn"
          onClick={() => handleSubmit("transcribe")}
          disabled={processingMode === "diarize"}
        >
          {loading && processingMode === "transcribe"
            ? "Processing..."
            : "Transcribe"}
        </button>

        <button
          className="action-btn"
          onClick={() => handleSubmit("diarize")}
          disabled={processingMode === "transcribe"}
        >
          {loading && processingMode === "diarize"
            ? "Processing..."
            : "Diarize"}
        </button>
      </div>
    </div>
  )
}
