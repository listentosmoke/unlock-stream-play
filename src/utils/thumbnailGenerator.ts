export const generateVideoThumbnail = (videoFile: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.addEventListener('loadedmetadata', () => {
      // Set canvas size to video dimensions (or scale down if too large)
      const maxWidth = 640;
      const maxHeight = 360;
      
      let { videoWidth, videoHeight } = video;
      
      // Scale down if necessary while maintaining aspect ratio
      if (videoWidth > maxWidth || videoHeight > maxHeight) {
        const aspectRatio = videoWidth / videoHeight;
        if (videoWidth > videoHeight) {
          videoWidth = maxWidth;
          videoHeight = maxWidth / aspectRatio;
        } else {
          videoHeight = maxHeight;
          videoWidth = maxHeight * aspectRatio;
        }
      }

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      // Seek to 1 second or 10% of video duration, whichever is smaller
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate thumbnail'));
        }
        
        // Clean up
        URL.revokeObjectURL(video.src);
      }, 'image/jpeg', 0.8);
    });

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video for thumbnail generation'));
      URL.revokeObjectURL(video.src);
    });

    // Load the video file
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};