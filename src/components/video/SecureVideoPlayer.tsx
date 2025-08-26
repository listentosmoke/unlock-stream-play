import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecureVideoPlayerProps {
  video: any;
}

export function SecureVideoPlayer({ video }: SecureVideoPlayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecureVideoUrl();
  }, [video.id, user]);

  const fetchSecureVideoUrl = async () => {
    if (!user || !video.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-video-url', {
        body: { videoId: video.id }
      });

      if (error) throw error;

      setVideoUrl(data.signedUrl);
      
      // Auto-refresh URL before it expires (15 minutes)
      setTimeout(() => {
        fetchSecureVideoUrl();
      }, 13 * 60 * 1000); // Refresh after 13 minutes
      
    } catch (error: any) {
      console.error('Error fetching video URL:', error);
      toast({
        title: "Error",
        description: "Failed to load video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="aspect-video bg-muted rounded border flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-muted rounded border flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load video</p>
      </div>
    );
  }

  return (
    <div className="aspect-video">
      <video 
        src={videoUrl} 
        controls 
        className="w-full h-full rounded border"
        onError={() => {
          toast({
            title: "Video Error",
            description: "There was an issue playing the video. Please refresh the page.",
            variant: "destructive",
          });
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}