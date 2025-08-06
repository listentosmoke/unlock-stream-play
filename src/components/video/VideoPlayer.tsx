import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Play, Lock, Coins, Eye } from 'lucide-react';

interface VideoPlayerProps {
  video: any;
  onUnlock?: () => void;
}

export function VideoPlayer({ video, onUnlock }: VideoPlayerProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUnlockStatus();
  }, [video.id, user]);

  const checkUnlockStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_unlocks')
        .select('id')
        .eq('video_id', video.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsUnlocked(!!data);
    } catch (error) {
      console.error('Error checking unlock status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!user || !userProfile) {
      toast({
        title: "Error",
        description: "Please log in to unlock videos",
        variant: "destructive",
      });
      return;
    }

    if (userProfile.points < video.unlock_cost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${video.unlock_cost} points to unlock this video`,
        variant: "destructive",
      });
      return;
    }

    setIsUnlocking(true);

    try {
      // Create unlock record
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

      // Update user's points
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ points: userProfile.points - video.unlock_cost })
        .eq('user_id', user.id);

      if (profileUpdateError) throw profileUpdateError;

      // Update video unlock count
      const { error: videoUpdateError } = await supabase
        .from('videos')
        .update({ unlock_count: video.unlock_count + 1 })
        .eq('id', video.id);

      if (videoUpdateError) throw videoUpdateError;

      setIsUnlocked(true);
      toast({
        title: "Success!",
        description: "Video unlocked successfully",
      });

      if (onUnlock) onUnlock();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unlock video",
        variant: "destructive",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{video.title}</CardTitle>
            {video.description && (
              <CardDescription className="mt-1">{video.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {video.view_count} views
            </Badge>
            {isUnlocked && (
              <Badge className="bg-success text-success-foreground">
                Unlocked
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isUnlocked && video.full_video_url ? (
          <div className="aspect-video">
            <video 
              src={video.full_video_url} 
              controls 
              className="w-full h-full rounded border"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded border flex items-center justify-center">
            <div className="text-center">
              <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                This video is locked. Unlock it to watch.
              </p>
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Coins className="h-4 w-4 text-warning" />
                    <span>Cost: {video.unlock_cost} points</span>
                    <span>•</span>
                    <span>Your points: {userProfile?.points || 0}</span>
                  </div>
                  <Button 
                    onClick={handleUnlock}
                    disabled={isUnlocking || (userProfile?.points || 0) < video.unlock_cost}
                  >
                    {isUnlocking ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Unlocking...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Unlock Video ({video.unlock_cost} points)
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Please log in to unlock this video
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}