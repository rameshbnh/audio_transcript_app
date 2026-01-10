import { useState, useRef } from "react";
import { uploadAudio } from "../api";

export default function UploadForm({ onModeChange, onResult }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingMode, setProcessingMode] = useState(null);
  const fileInputRef = useRef(null);

  async function handleSubmit(selectedMode) {
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

  return (
    <div className="card">
      <h2>🎧 Audio Upload</h2>

      <div
        className="upload-box"
        onClick={() => fileInputRef.current.click()}
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
          onChange={(e) => {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setFileName(selectedFile ? selectedFile.name : "");
          }}
          hidden
        />
      </div>

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