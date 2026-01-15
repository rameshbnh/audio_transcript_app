export default function Results({ result, mode }) {
  if (!result) return null;

  let displayText = "";
  let title = "";

  if (mode === "transcribe") {
    title = "Transcript";
    if (result.segments && Array.isArray(result.segments)) {
      displayText = result.segments.map(segment => {
        const startTime = segment.start !== undefined ? segment.start : 0;
        const text = segment.text || '';
        
        // Convert seconds to HH:MM:SS format
        const hours = Math.floor(startTime / 3600);
        const minutes = Math.floor((startTime % 3600) / 60);
        const seconds = Math.floor(startTime % 60);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return `[${timeString}] ${text}`;
      }).join('\n');
    } else {
      displayText = result.transcript || JSON.stringify(result, null, 2);
    }
  } else if (mode === "diarize") {
    title = "Diarization";
    if (result.segments && Array.isArray(result.segments)) {
      // Format diarization to show only speaker and text (without timestamps)
      displayText = result.segments.map(segment => {
        const speaker = segment.speaker || 'Speaker';
        const text = segment.text || '';
        
        return `${speaker}: ${text}`;
      }).join('\n');
    } else if (result.transcript) {
      displayText = result.transcript;
    } else {
      displayText = JSON.stringify(result, null, 2);
    }
  } else {
    displayText = JSON.stringify(result, null, 2);
  }

  const downloadJSON = () => {
    const dataStr = JSON.stringify(result, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadMarkdown = () => {
    let content = "";
    if (mode === "transcribe") {
      if (result.segments && Array.isArray(result.segments)) {
        content = result.segments.map(segment => {
          const startTime = segment.start !== undefined ? segment.start : 0;
          const text = segment.text || '';
          
          // Convert seconds to HH:MM:SS format
          const hours = Math.floor(startTime / 3600);
          const minutes = Math.floor((startTime % 3600) / 60);
          const seconds = Math.floor(startTime % 60);
          
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          
          return `[${timeString}] ${text}`;
        }).join('\n');
      } else {
        content = result.transcript || JSON.stringify(result, null, 2);
      }
    } else if (mode === "diarize") {
      if (result.segments && Array.isArray(result.segments)) {
        // Format diarization to show only speaker and text (without timestamps)
        content = result.segments.map(segment => {
          const speaker = segment.speaker || 'Speaker';
          const text = segment.text || '';
          
          return `${speaker}: ${text}`;
        }).join('\n');
      } else if (result.transcript) {
        content = result.transcript;
      } else {
        content = JSON.stringify(result, null, 2);
      }
    } else {
      content = JSON.stringify(result, null, 2);
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="result-box">
      <div className="result-header">
        <h3>{title}</h3>
        <div className="button-group">
          <button className="download-btn" onClick={downloadJSON}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM14 8V3.5L18.5 8H14ZM12 9L8 13H10V18H14V13H16L12 9Z" fill="white"/>
            </svg>
            Download JSON
          </button>
          <button className="download-btn" onClick={downloadMarkdown}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM14 8V3.5L18.5 8H14ZM12 9L8 13H10V18H14V13H16L12 9Z" fill="white"/>
            </svg>
            Download Markdown
          </button>
        </div>
      </div>
      <div className="transcript">{displayText}</div>
    </div>
  );
}
