import { useEffect, useRef, useState, useCallback } from 'react';
import { presignGetUrl } from '@/utils/r2';

type Props = {
  objectKey?: string;
  legacyUrl?: string;    // old rows that stored a full presigned URL
  mimeType?: string;     // default 'video/mp4'
  poster?: string;       // thumbnail url
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onUrl?: (url: string) => void; // for "open in new tab"
};

const REFRESH_MARGIN_S = 120; // refresh 2 minutes before expiry
const DEFAULT_TTL_S = 3600;

function deriveObjectKeyFromLegacyUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    // R2 virtual-hosted endpoint path is "/<objectKey>"
    const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    return path || null;
  } catch {
    return null;
  }
}

export default function VideoPlayer({
  objectKey,
  legacyUrl,
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
      let key = objectKey;
      if (!key && legacyUrl) {
        key = deriveObjectKeyFromLegacyUrl(legacyUrl) || undefined;
        if (!key) {
          // As an absolute last-resort fallback (discouraged): use legacyUrl directly.
          console.warn('[VideoPlayer] Could not parse objectKey from legacyUrl; using legacy URL directly (may expire).');
          setLiveUrl(legacyUrl);
          onUrl?.(legacyUrl);
          setLoading(false);
          return;
        }
      }

      if (!key) {
        throw new Error('No video source available (missing objectKey/legacyUrl)');
      }

      console.debug('[VideoPlayer] Presigning GET for', { objectKey: key, mimeType });
      const url = await presignGetUrl(key, mimeType, DEFAULT_TTL_S);
      setLiveUrl(url);
      onUrl?.(url);

      // schedule a refresh a bit before expiry
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const refreshInMs = Math.max((DEFAULT_TTL_S - REFRESH_MARGIN_S) * 1000, 30_000);
      timerRef.current = window.setTimeout(() => {
        fetchUrl().catch(() => {/* retry on play/error anyway */});
      }, refreshInMs);
    } catch (e: any) {
      console.error('[VideoPlayer] Failed to get playback URL:', e);
      setErr(e?.message || 'Failed to get playback URL');
    } finally {
      setLoading(false);
    }
  }, [objectKey, legacyUrl, mimeType, onUrl]);

  useEffect(() => {
    fetchUrl();
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchUrl]);

  const handlePlay = async () => {
    if (!liveUrl) {
      await fetchUrl();
      videoRef.current?.load();
      try { await videoRef.current?.play(); } catch {}
    }
  };

  const handleError = async () => {
    // If expired mid-play or network hiccup, one immediate refresh
    try {
      await fetchUrl();
      videoRef.current?.load();
      if (autoPlay) {
        try { await videoRef.current?.play(); } catch {}
      }
    } catch (e) {
      console.error('[VideoPlayer] refresh after error failed', e);
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
      // helpful for R2 cross-origin range requests
      crossOrigin="anonymous"
      playsInline
    >
      {liveUrl ? <source src={liveUrl} type={mimeType} /> : null}
      {loading ? 'Loading…' : 'Your browser cannot play this video.'}
    </video>
  );
}
