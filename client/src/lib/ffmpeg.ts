import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && isLoaded) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();
  
  try {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    // Load ffmpeg with progress reporting
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    isLoaded = true;
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    throw new Error('FFmpeg failed to load. Video cropping is not available.');
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
  try {
    onProgress?.({ progress: 10, message: 'Loading video processor...' });
    
    const ffmpegInstance = await loadFFmpeg();
    
    onProgress?.({ progress: 30, message: 'Preparing video...' });
    
    // Write input file
    const inputFileName = `input.${file.name.split('.').pop()}`;
    const outputFileName = 'output.mp4';
    
    await ffmpegInstance.writeFile(inputFileName, await fetchFile(file));
    
    onProgress?.({ progress: 50, message: 'Cropping video...' });
    
    // Trim video with stream copy first, fallback to re-encode
    try {
      // Try stream copy for fast processing (place -ss before -i for accuracy)
      await ffmpegInstance.exec([
        '-ss', startSeconds.toString(),
        '-i', inputFileName,
        '-t', durationSeconds.toString(),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputFileName
      ]);
    } catch (streamCopyError) {
      console.log('Stream copy failed, falling back to re-encoding...');
      
      // Fallback to re-encoding for accuracy
      await ffmpegInstance.exec([
        '-ss', startSeconds.toString(),
        '-i', inputFileName,
        '-t', durationSeconds.toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-y',
        outputFileName
      ]);
    }
    
    onProgress?.({ progress: 80, message: 'Finalizing...' });
    
    // Read the output file
    const outputData = await ffmpegInstance.readFile(outputFileName);
    
    // Clean up
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(outputFileName);
    
    onProgress?.({ progress: 100, message: 'Complete!' });
    
    // Create blob from the trimmed video
    const blob = new Blob([outputData], { type: 'video/mp4' });
    return blob;
    
  } catch (error) {
    console.error('FFmpeg trimming failed:', error);
    
    // Fallback: Use MediaRecorder API to record a 5-second segment
    return await fallbackTrim(file, startSeconds, durationSeconds, onProgress);
  }
}

async function fallbackTrim(
  file: File, 
  startSeconds: number, 
  durationSeconds: number,
  onProgress?: (progress: TrimProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress?.({ progress: 20, message: 'Using fallback method...' });
    
    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(file);
    
    video.onloadedmetadata = () => {
      onProgress?.({ progress: 40, message: 'Recording segment...' });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Select a supported MIME type
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              reject(new Error('No supported video format for recording'));
              return;
            }
          }
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        onProgress?.({ progress: 90, message: 'Processing...' });
        const blob = new Blob(chunks, { type: mimeType });
        onProgress?.({ progress: 100, message: 'Complete!' });
        URL.revokeObjectURL(video.src);
        resolve(blob);
      };
      
      video.currentTime = startSeconds;
      video.onseeked = () => {
        mediaRecorder.start();
        video.play();
        
        const drawFrame = () => {
          if (video.currentTime >= startSeconds + durationSeconds) {
            mediaRecorder.stop();
            video.pause();
            URL.revokeObjectURL(video.src);
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
      };
    };
    
    video.onerror = () => {
      reject(new Error('Failed to process video with fallback method'));
    };
  });
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const deciseconds = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${deciseconds}`;
}