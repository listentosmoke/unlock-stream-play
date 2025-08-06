import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Play, Lock, Star, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VideoThumbnail } from './VideoThumbnail';
import { VideoPlaceholder } from './VideoPlaceholder';

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    description?: string;
    thumbnail_url?: string;
    preview_url?: string;
    full_video_url?: string;
    duration?: number;
    unlock_cost: number;
    view_count: number;
    unlock_count: number;
    uploader_id: string;
    status: string;
  };
  isUnlocked?: boolean;
  onUnlock?: () => void;
  onClick?: () => void;
}

export function VideoCard({ video, isUnlocked = false, onUnlock, onClick }: VideoCardProps) {
  const [loading, setLoading] = useState(false);
  const { user, userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUnlock = async () => {
    if (!user || !userProfile) {
      toast({
        title: "Sign in required",
        description: "Please sign in to unlock videos",
        variant: "destructive",
      });
      return;
    }

    if (userProfile.points < video.unlock_cost) {
      toast({
        title: "Insufficient points",
        description: `You need ${video.unlock_cost} points to unlock this video`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Create unlock record and deduct points
      const { error: unlockError } = await supabase
        .from('user_unlocks')
        .insert({
          user_id: user.id,
          video_id: video.id
        });

      if (unlockError) throw unlockError;

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: -video.unlock_cost,
          type: 'unlock',
          description: `Unlocked video: ${video.title}`,
          video_id: video.id
        });

      if (transactionError) throw transactionError;

      // Update user points
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ points: userProfile.points - video.unlock_cost })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      onUnlock?.();
      
      toast({
        title: "Video unlocked!",
        description: `You can now watch the full video`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unlock video",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/video/${video.id}`);
    }
  };

  return (
    <Card 
      className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 cursor-pointer" 
      onClick={handleCardClick}
    >
      <div className="relative aspect-video bg-video-bg overflow-hidden">
        {(() => {
          console.log('VideoCard thumbnail logic:', { 
            hasThumbnailUrl: !!video.thumbnail_url, 
            hasFullVideoUrl: !!video.full_video_url,
            thumbnailUrl: video.thumbnail_url,
            videoTitle: video.title
          });
          
          if (video.thumbnail_url) {
            return (
              <img 
                src={video.thumbnail_url} 
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  console.log('Thumbnail image failed to load:', video.thumbnail_url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            );
          } else if (video.full_video_url) {
            return (
              <VideoThumbnail 
                videoUrl={video.full_video_url}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            );
          } else {
            return (
              <VideoPlaceholder 
                title={video.title}
                className="w-full h-full"
              />
            );
          }
        })()}
        
        {/* Duration badge */}
        {video.duration && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 right-2 bg-video-bg/80 text-white border-0"
          >
            {formatDuration(video.duration)}
          </Badge>
        )}

        {/* Lock overlay for locked videos */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-video-overlay backdrop-blur-sm flex items-center justify-center">
            <div className="text-center text-white">
              <Lock className="h-12 w-12 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Preview Only</p>
              <p className="text-xs text-white/80">{video.unlock_cost} points to unlock</p>
            </div>
          </div>
        )}

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button 
            size="lg" 
            className="rounded-full h-16 w-16 p-0 bg-primary/90 hover:bg-primary"
          >
            <Play className="h-6 w-6 ml-1" fill="currentColor" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {video.title}
            </h3>
            {video.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {video.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {video.view_count}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {video.unlock_count}
              </span>
            </div>
          </div>

          {!isUnlocked && user && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                handleUnlock();
              }}
              disabled={loading || !userProfile || userProfile.points < video.unlock_cost}
              className="w-full"
              variant="outline"
            >
              {loading ? 'Unlocking...' : `Unlock for ${video.unlock_cost} points`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}