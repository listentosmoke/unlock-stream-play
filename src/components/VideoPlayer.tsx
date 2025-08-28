import { useEffect, useRef, useState, useCallback } from 'react';
import { presignGetUrl } from '@/utils/r2';

type Props = {
  objectKey: string;
  mimeType?: string;     // default 'video/mp4'
  poster?: string;       // thumbnail url
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  style?: React.CSSProperties;
  // If you render an "Open in new tab" anchor, feed it from the liveUrl state below
  onUrl?: (url: string) => void;
};

const REFRESH_MARGIN_S = 120; // refresh 2 minutes before expiry
const DEFAULT_TTL_S = 3600;

export default function VideoPlayer({
  objectKey,
  mimeType = 'video/mp4',
  poster,
  autoPlay,
  controls = true,
  className,
  style,
  onUrl,
}: Props) {
  const [liveUrl, setLiveUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchUrl = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const url = await presignGetUrl(objectKey, mimeType, DEFAULT_TTL_S);
      setLiveUrl(url);
      onUrl?.(url);

      // Clear existing refresh timer
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Schedule refresh a bit before it expires
      const refreshInMs = Math.max((DEFAULT_TTL_S - REFRESH_MARGIN_S) * 1000, 30_000);
      timerRef.current = window.setTimeout(() => {
        fetchUrl().catch(() => {/* swallow; will retry on play/error */});
      }, refreshInMs);
    } catch (e: any) {
      setErr(e?.message || 'Failed to get playback URL');
    } finally {
      setLoading(false);
    }
  }, [objectKey, mimeType, onUrl]);

  useEffect(() => {
    fetchUrl();
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchUrl]);

  // If fetch failed or URL expired mid-play, retry when user hits play
  const handlePlay = async () => {
    if (!liveUrl) {
      await fetchUrl();
      // re-attach source and play
      videoRef.current?.load();
      try { await videoRef.current?.play(); } catch {}
    }
  };

  // If the <video> errors (e.g., 403/ExpiredRequest), auto-refresh once
  const handleError = async () => {
    // Try one immediate refresh then reload the element
    try {
      await fetchUrl();
      videoRef.current?.load();
      if (autoPlay) {
        try { await videoRef.current?.play(); } catch {}
      }
    } catch (e) {
      // surface error to UI
    }
  };

  if (err) {
    return (
      <div className={className}>
        <div className="text-sm text-red-500">Playback error: {err}</div>
        <button className="text-xs underline" onClick={fetchUrl}>Retry</button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      poster={poster}
      controls={controls}
      autoPlay={autoPlay}
      onPlay={handlePlay}
      onError={handleError}
      preload="metadata"
    >
      {liveUrl ? <source src={liveUrl} type={mimeType} /> : null}
      {loading ? 'Loading…' : 'Your browser cannot play this video.'}
    </video>
  );
}