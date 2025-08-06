import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { Header } from '@/components/layout/Header';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { VideoPlaceholder } from '@/components/video/VideoPlaceholder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Play, Lock, Coins, Eye, Users } from 'lucide-react';

const Video = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [video, setVideo] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [userUnlocks, setUserUnlocks] = useState<string[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchVideo();
      fetchRecommendedVideos();
      if (user) {
        fetchUserUnlocks();
      }
    }
  }, [id, user]);

  const fetchVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setVideo(data);
    } catch (error) {
      console.error('Error fetching video:', error);
      toast({
        title: "Error",
        description: "Video not found",
        variant: "destructive",
      });
    }
  };

  const fetchRecommendedVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'approved')
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecommendedVideos(data || []);
    } catch (error) {
      console.error('Error fetching recommended videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserUnlocks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_unlocks')
        .select('video_id')
        .eq('user_id', user.id);

      if (error) throw error;
      const unlockedIds = data?.map(unlock => unlock.video_id) || [];
      setUserUnlocks(unlockedIds);
      setIsUnlocked(unlockedIds.includes(id));
    } catch (error) {
      console.error('Error fetching unlocks:', error);
    }
  };

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

      // Update user points
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ points: userProfile.points - video.unlock_cost })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update video unlock count
      const { error: videoUpdateError } = await supabase
        .from('videos')
        .update({ unlock_count: video.unlock_count + 1 })
        .eq('id', video.id);

      if (videoUpdateError) throw videoUpdateError;

      await refreshProfile();
      setIsUnlocked(true);
      
      toast({
        title: "Video unlocked!",
        description: "You can now watch the full video",
      });
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

  if (loading || !video) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading video...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to videos</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main video player */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-video-bg rounded-lg overflow-hidden mb-4 relative">
              {isUnlocked ? (
                video.full_video_url ? (
                  <video 
                    controls 
                    className="w-full h-full"
                    poster={video.thumbnail_url}
                  >
                    <source src={video.full_video_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p className="text-sm sm:text-base">Video file not available</p>
                  </div>
                )
              ) : (
                <div className="relative w-full h-full">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                      onLoad={() => console.log('Main video thumbnail loaded:', video.thumbnail_url)}
                      onError={(e) => {
                        console.log('Main video thumbnail failed to load:', video.thumbnail_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Play className="h-12 w-12 sm:h-16 sm:w-16 text-primary/50" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-video-overlay backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="text-center text-white max-w-sm">
                      <Lock className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-primary" />
                      <p className="text-base sm:text-lg font-medium mb-2">Preview Only</p>
                      <p className="text-white/80 mb-4 text-sm sm:text-base">{video.unlock_cost} points to unlock</p>
                      {user ? (
                        <Button 
                          onClick={handleUnlock}
                          disabled={isUnlocking || !userProfile || userProfile.points < video.unlock_cost}
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          {isUnlocking ? 'Unlocking...' : `Unlock for ${video.unlock_cost} points`}
                        </Button>
                      ) : (
                        <Button asChild size="lg" className="w-full sm:w-auto">
                          <Link to="/auth">Sign in to unlock</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Video details */}
            <div className="space-y-4">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{video.title}</h1>
              
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {video.view_count} views
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {video.unlock_count} unlocks
                </span>
                <Badge variant="secondary" className="text-xs">{video.unlock_cost} points</Badge>
              </div>

              {video.description && (
                <div className="bg-card p-3 sm:p-4 rounded-lg">
                  <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{video.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommended videos sidebar */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Recommended Videos</h2>
            <div className="space-y-3 sm:space-y-4">
              {recommendedVideos.map((recommendedVideo) => (
                <div key={recommendedVideo.id} className="flex gap-3">
                  <div 
                    className="relative w-28 sm:w-32 lg:w-40 aspect-video bg-video-bg rounded overflow-hidden cursor-pointer flex-shrink-0"
                    onClick={() => navigate(`/video/${recommendedVideo.id}`)}
                  >
                    {recommendedVideo.thumbnail_url ? (
                      <img 
                        src={recommendedVideo.thumbnail_url} 
                        alt={recommendedVideo.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                        onLoad={() => console.log('Recommended thumbnail loaded:', recommendedVideo.thumbnail_url)}
                        onError={(e) => {
                          console.log('Recommended thumbnail failed to load:', recommendedVideo.thumbnail_url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Play className="h-4 w-4 sm:h-6 sm:w-6 text-primary/50" />
                      </div>
                    )}
                      
                    {!userUnlocks.includes(recommendedVideo.id) && (
                      <div className="absolute inset-0 bg-video-overlay/50 flex items-center justify-center">
                        <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-medium text-xs sm:text-sm line-clamp-2 cursor-pointer hover:text-primary leading-tight"
                      onClick={() => navigate(`/video/${recommendedVideo.id}`)}
                    >
                      {recommendedVideo.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{recommendedVideo.view_count} views</span>
                      <span>•</span>
                      <span>{recommendedVideo.unlock_cost} points</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Video;