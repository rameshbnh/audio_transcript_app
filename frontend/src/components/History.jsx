import { useState, useEffect } from "react";
import { fetchHistory, fetchTranscriptionResult } from "../api";

export default function History({ onResultClick }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const data = await fetchHistory();
        setHistory(data);
      } catch (err) {
        setError("Failed to load history");
        console.error("Error loading history:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewResult = async (item) => {
    // Load the result and pass it to the parent component to display in the main output
    try {
      const resultData = await fetchTranscriptionResult(item.id);
      // Call the parent callback to update the main result in the output panel
      if (onResultClick) {
        onResultClick(resultData.result, resultData.mode);
      }
    } catch (err) {
      console.error("Error fetching transcription result:", err);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading history...</div>;
  }

  if (error) {
    return <div className="empty-state">Error: {error}</div>;
  }

  if (history.length === 0) {
    return <div className="empty-state">No transcription history found</div>;
  }

  return (
    <div className="card">
      <h3>Transcription History</h3>
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-header">
              <span className="filename">{item.filename}</span>
              <span className={`mode-badge ${item.mode}`}>
                {item.mode}
              </span>
            </div>
            <div className="history-details">
              <div className="detail-row">
                <span className="label">Date:</span>
                <span className="value">{formatDate(item.timestamp)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Duration:</span>
                <span className="value">{formatDuration(item.audio_duration)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Size:</span>
                <span className="value">{formatSize(item.size)}</span>
              </div>
              <div className="button-row">
                <button
                  className="view-result-btn"
                  onClick={() => handleViewResult(item)}
                >
                  Load Result
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
