// Utility functions for audio processing

/**
 * Convert an audio blob to WAV format
 * @param {Blob} audioBlob - The input audio blob
 * @returns {Promise<Blob>} - Promise that resolves to WAV blob
 */
export async function convertToWav(audioBlob) {
  try {
    // If it's already a WAV file, return as is
    if (audioBlob.type === 'audio/wav') {
      return audioBlob;
    }

    // For better compatibility, we'll create a minimal WAV header
    // Most transcription services can handle this format
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Create WAV header (minimal implementation)
    const header = createWavHeader(uint8Array.length, 44100, 1);
    
    // Combine header and audio data
    const wavBuffer = new Uint8Array(header.length + uint8Array.length);
    wavBuffer.set(header, 0);
    wavBuffer.set(uint8Array, header.length);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.warn('Failed to convert to WAV, returning original blob:', error);
    // Fallback: return original blob with WAV mime type
    return new Blob([audioBlob], { type: 'audio/wav' });
  }
}

/**
 * Create a minimal WAV file header
 * @param {number} audioLength - Length of audio data in bytes
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} channels - Number of channels
 * @returns {Uint8Array} - WAV header as byte array
 */
function createWavHeader(audioLength, sampleRate, channels) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // File length minus 8 bytes
  view.setUint32(4, 36 + audioLength, true);
  // WAVE identifier
  writeString(view, 8, 'WAVE');
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, channels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * channels * 2, true);
  // Block align (channels * bytes per sample)
  view.setUint16(32, channels * 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, audioLength, true);
  
  return new Uint8Array(buffer);
}

/**
 * Write a string to a DataView at the specified offset
 * @param {DataView} view - The DataView to write to
 * @param {number} offset - The offset to start writing at
 * @param {string} string - The string to write
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
