import { useEffect, useRef, useState } from "react";
import { getReadUrl } from "@/lib/r2";

type Props = {
  objectKey: string;           // stored in your DB
  expiresSeconds?: number;     // default 3600
  autoPlay?: boolean;
  poster?: string;            // thumbnail URL
  className?: string;
};

export default function VideoPlayer({ 
  objectKey, 
  expiresSeconds = 3600, 
  autoPlay = false,
  poster,
  className = "w-full h-auto"
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch a fresh presigned URL and (re)attach to <video>, preserving position
  const refreshUrl = async (preserveTime = true) => {
    if (!objectKey) return;
    setError(null);
    
    try {
      const v = videoRef.current;
      const t = preserveTime && v ? v.currentTime || 0 : 0;

      const { readUrl, expiresIn } = await getReadUrl(objectKey, expiresSeconds);
      setSrc(readUrl);
      setExpiresAt(Date.now() + (expiresIn ?? expiresSeconds) * 1000);

      // After src swap, restore time & play
      queueMicrotask(() => {
        if (!v) return;
        v.src = readUrl;
        v.load();
        if (t > 0) v.currentTime = t;
        if (autoPlay) v.play().catch(() => {});
      });
      
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to get video URL:', err);
      setError(err.message || 'Failed to load video');
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    refreshUrl(false).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectKey]);

  // Timed refresh ~2 minutes before expiry
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const msLeft = expiresAt - Date.now();
      if (msLeft < 120_000) {                // 2 minutes remaining
        refreshUrl(true).catch(console.error);
      }
    }, 20_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Recover on player error (e.g., URL expired mid-stream)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onError = () => refreshUrl(true).catch(console.error);
    v.addEventListener("error", onError);
    return () => v.removeEventListener("error", onError);
  }, [objectKey]);

  if (loading) {
    return (
      <div className={`${className} bg-muted rounded flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-muted rounded flex flex-col items-center justify-center p-4`}>
        <div className="text-sm text-destructive mb-2">Failed to load video</div>
        <button 
          onClick={() => refreshUrl(false)}
          className="text-xs underline text-primary hover:text-primary/80"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      poster={poster}
      className={className}
      style={{ background: "black" }}
      // src is set in refreshUrl; leaving empty here avoids flashing stale URLs
    />
  );
}