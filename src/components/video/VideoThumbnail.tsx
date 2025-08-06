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

  useEffect(() => {
    generateThumbnail();
  }, [videoUrl]);

  const generateThumbnail = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    video.addEventListener('loadeddata', () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
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
    });

    video.addEventListener('error', () => {
      setLoading(false);
    });

    // Set video source and load first frame
    video.src = videoUrl;
    video.currentTime = 0.1; // Seek to a small time to get a frame
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