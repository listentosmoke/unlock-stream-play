import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface VideoThumbnailProps {
  videoUrl: string;
  alt: string;
  className?: string;
}

export function VideoThumbnail({ videoUrl, alt, className }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setThumbnailUrl('');
    generateThumbnail();
  }, [videoUrl]);

  const generateThumbnail = async () => {
    if (!videoRef.current || !canvasRef.current || !videoUrl) {
      setLoading(false);
      setError(true);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setLoading(false);
      setError(true);
      return;
    }

    let hasLoaded = false;

    const handleLoadedData = () => {
      if (hasLoaded) return;
      hasLoaded = true;
      
      try {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        
        // Draw the first frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and create URL
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setThumbnailUrl(url);
          }
          setLoading(false);
        }, 'image/jpeg', 0.8);
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        setError(true);
        setLoading(false);
      }
    };

    const handleError = (e: Event) => {
      console.error('Video loading error:', e);
      setError(true);
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      if (video.currentTime > 0) {
        handleLoadedData();
      }
    };

    // Add event listeners
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('loadedmetadata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    // Cleanup function
    const cleanup = () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadedmetadata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };

    try {
      // Set video properties
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      
      // Set video source and load first frame
      video.src = videoUrl;
      video.currentTime = 0.5; // Seek to half a second to get a frame
      
      // Fallback timeout
      setTimeout(() => {
        if (loading && !hasLoaded) {
          cleanup();
          setError(true);
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      return cleanup;
    } catch (err) {
      console.error('Error setting up video:', err);
      setError(true);
      setLoading(false);
      return cleanup;
    }
  };

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        muted
        playsInline
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {thumbnailUrl ? (
        <img 
          src={thumbnailUrl} 
          alt={alt}
          className={className}
        />
      ) : (
        <div className={`bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${className}`}>
          <Play className="h-16 w-16 text-primary/50" />
        </div>
      )}
    </>
  );
}