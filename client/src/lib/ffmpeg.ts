import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;
let isLoading = false;

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && isLoaded) {
    return ffmpeg;
  }
  
  if (isLoading) {
    // Wait for ongoing loading
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isLoaded && ffmpeg) {
          clearInterval(checkInterval);
          resolve(ffmpeg);
        } else if (!isLoading) {
          clearInterval(checkInterval);
          reject(new Error('FFmpeg loading failed'));
        }
      }, 100);
    });
  }
  
  isLoading = true;
  ffmpeg = new FFmpeg();
  
  try {
    // Try multiple CDN sources for better reliability
    const cdnSources = [
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
      'https://cdn.skypack.dev/@ffmpeg/core@0.12.6/dist/esm'
    ];
    
    let loadSuccess = false;
    let lastError: Error | null = null;
    
    for (const baseURL of cdnSources) {
      try {
        console.log(`Attempting to load FFmpeg from: ${baseURL}`);
        
        ffmpeg.on('log', ({ message }) => {
          console.log('FFmpeg:', message);
        });
        
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        loadSuccess = true;
        console.log('FFmpeg loaded successfully!');
        break;
      } catch (error) {
        console.warn(`Failed to load from ${baseURL}:`, error);
        lastError = error as Error;
        continue;
      }
    }
    
    if (!loadSuccess) {
      throw lastError || new Error('All CDN sources failed');
    }
    
    isLoaded = true;
    isLoading = false;
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg from all sources:', error);
    isLoading = false;
    throw new Error('FFmpeg failed to load. Using fallback video processing.');
  }
}

export interface TrimProgress {
  progress: number; // 0-100
  message: string;
}

export async function trimVideo(
  file: File, 
  startSeconds: number, 
  durationSeconds: number = 5,
  onProgress?: (progress: TrimProgress) => void
): Promise<Blob> {
  // Always try the improved fallback method first for better reliability
  console.log('Starting video trimming with enhanced fallback method');
  onProgress?.({ progress: 5, message: 'Initializing video processor...' });
  
  try {
    // Try FFmpeg first but with shorter timeout
    const ffmpegPromise = trimWithFFmpeg(file, startSeconds, durationSeconds, onProgress);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('FFmpeg timeout')), 10000) // 10 second timeout
    );
    
    return await Promise.race([ffmpegPromise, timeoutPromise]);
  } catch (error) {
    console.log('FFmpeg failed or timed out, using enhanced fallback:', error);
    return await enhancedFallbackTrim(file, startSeconds, durationSeconds, onProgress);
  }
}

async function trimWithFFmpeg(
  file: File,
  startSeconds: number,
  durationSeconds: number,
  onProgress?: (progress: TrimProgress) => void
): Promise<Blob> {
  onProgress?.({ progress: 10, message: 'Loading FFmpeg...' });
  
  const ffmpegInstance = await loadFFmpeg();
  
  onProgress?.({ progress: 30, message: 'Processing with FFmpeg...' });
  
  const inputFileName = `input_${Date.now()}.${file.name.split('.').pop()}`;
  const outputFileName = `output_${Date.now()}.mp4`;
  
  await ffmpegInstance.writeFile(inputFileName, await fetchFile(file));
  
  onProgress?.({ progress: 60, message: 'Trimming video...' });
  
  // Use more reliable FFmpeg command
  await ffmpegInstance.exec([
    '-ss', startSeconds.toString(),
    '-i', inputFileName,
    '-t', durationSeconds.toString(),
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-movflags', '+faststart',
    '-y',
    outputFileName
  ]);
  
  onProgress?.({ progress: 85, message: 'Finalizing...' });
  
  const outputData = await ffmpegInstance.readFile(outputFileName);
  
  // Clean up
  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);
  
  onProgress?.({ progress: 100, message: 'Complete!' });
  
  return new Blob([outputData], { type: 'video/mp4' });
}

async function enhancedFallbackTrim(
  file: File, 
  startSeconds: number, 
  durationSeconds: number,
  onProgress?: (progress: TrimProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress?.({ progress: 25, message: 'Using enhanced processing method...' });
    
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    
    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video processing timeout'));
    }, 30000); // 30 second timeout
    
    video.onloadedmetadata = async () => {
      try {
        onProgress?.({ progress: 40, message: 'Setting up video capture...' });
        
        // Ensure video dimensions are valid
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          throw new Error('Invalid video dimensions');
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false })!;
        
        // Use appropriate canvas size
        const maxSize = 1920; // Max resolution
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        if (video.videoWidth > maxSize || video.videoHeight > maxSize) {
          if (aspectRatio > 1) {
            canvas.width = maxSize;
            canvas.height = maxSize / aspectRatio;
          } else {
            canvas.width = maxSize * aspectRatio;
            canvas.height = maxSize;
          }
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Try different MIME types for better compatibility, prioritizing MP4 for Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        const mimeTypes = isSafari ? [
          'video/mp4;codecs=h264,aac',
          'video/mp4',
          'video/webm;codecs=h264,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ] : [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/mp4;codecs=h264,aac',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4'
        ];
        
        let selectedMimeType = '';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }
        
        if (!selectedMimeType) {
          throw new Error('No supported video format available');
        }
        
        console.log('Using MIME type:', selectedMimeType);
        
        // Try to capture both video and audio streams
        let recordingStream: MediaStream;
        
        try {
          // Try to get audio from the video element
          const videoStream = (video as any).captureStream ? (video as any).captureStream() : null;
          const canvasStream = canvas.captureStream(30);
          
          if (videoStream && videoStream.getAudioTracks().length > 0) {
            // Combine canvas video with original audio
            recordingStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...videoStream.getAudioTracks()
            ]);
            console.log('Using video + audio stream');
          } else {
            // Fallback to canvas-only stream (no audio)
            recordingStream = canvasStream;
            console.log('Using canvas-only stream (no audio available)');
          }
        } catch (error) {
          console.warn('Failed to capture audio, using canvas-only:', error);
          recordingStream = canvas.captureStream(30);
        }
        
        const mediaRecorder = new MediaRecorder(recordingStream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        const chunks: BlobPart[] = [];
        let recordingStarted = false;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          onProgress?.({ progress: 90, message: 'Finalizing video...' });
          
          const blob = new Blob(chunks, { type: selectedMimeType });
          onProgress?.({ progress: 100, message: 'Complete!' });
          cleanup();
          resolve(blob);
        };
        
        mediaRecorder.onerror = (event) => {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(`Recording failed: ${event}`));
        };
        
        // Seek to start position
        video.currentTime = startSeconds;
        
        video.onseeked = () => {
          if (!recordingStarted) {
            recordingStarted = true;
            onProgress?.({ progress: 60, message: 'Recording video segment...' });
            
            mediaRecorder.start(100); // Record in 100ms chunks
            video.play();
            
            let frameCount = 0;
            const targetFrames = durationSeconds * 30; // 30 FPS
            
            const drawFrame = () => {
              if (video.currentTime >= startSeconds + durationSeconds || frameCount >= targetFrames) {
                mediaRecorder.stop();
                video.pause();
                return;
              }
              
              // Draw current video frame to canvas
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              frameCount++;
              
              requestAnimationFrame(drawFrame);
            };
            
            drawFrame();
          }
        };
        
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    };
    
    video.onerror = (e) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Video loading failed: ${e}`));
    };
    
    video.onabort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Video loading was aborted'));
    };
  });
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const deciseconds = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${deciseconds}`;
}

// Add fallback trim as an alias for backward compatibility
export const fallbackTrim = enhancedFallbackTrim;