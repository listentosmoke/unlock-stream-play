import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { Header } from '@/components/layout/Header';
import { VideoCard } from '@/components/video/VideoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Coins, Upload, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [userUnlocks, setUserUnlocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
    if (user) {
      fetchUserUnlocks();
    }
  }, [user]);

  const fetchVideos = async () => {
    try {
      // Only select safe fields for public video browsing - exclude sensitive URLs
      const { data, error } = await supabase
        .from('videos')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          duration,
          unlock_cost,
          view_count,
          unlock_count,
          uploader_id,
          status,
          created_at
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
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
      setUserUnlocks(data?.map(unlock => unlock.video_id) || []);
    } catch (error) {
      console.error('Error fetching unlocks:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading videos...</p>
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
            {/* Hero Section */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
                Premium Video Experience
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
                Discover exclusive content, unlock premium videos with points, and earn rewards by sharing your creativity
              </p>
              
              {!user && (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                  <Button size="lg" className="w-full sm:w-auto" asChild>
                    <Link to="/auth">Get Started</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                    <Link to="/about">Learn More</Link>
                  </Button>
                </div>
              )}

              {user && (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
                  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                    <div className="flex items-center space-x-2 bg-success/10 px-4 py-2 rounded-full">
                      <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                      <span className="font-semibold text-success text-sm sm:text-base">
                        {userProfile?.points || 0} Points
                      </span>
                    </div>
                    <Button className="w-full sm:w-auto" asChild>
                      <Link to="/upload">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Video
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 px-4">
              <div className="text-center p-4 sm:p-6 rounded-lg bg-card border border-border/50 hover:border-primary/20 transition-colors">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
                <h3 className="text-xl sm:text-2xl font-bold">{videos.length + 100}+</h3>
                <p className="text-muted-foreground text-sm sm:text-base">Premium Videos</p>
              </div>
              <div className="text-center p-4 sm:p-6 rounded-lg bg-card border border-border/50 hover:border-success/20 transition-colors">
                <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-success mx-auto mb-2" />
                <h3 className="text-xl sm:text-2xl font-bold">10</h3>
                <p className="text-muted-foreground text-sm sm:text-base">Points per Video</p>
              </div>
              <div className="text-center p-4 sm:p-6 rounded-lg bg-card border border-border/50 hover:border-accent/20 transition-colors">
                <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-accent mx-auto mb-2" />
                <h3 className="text-xl sm:text-2xl font-bold">5</h3>
                <p className="text-muted-foreground text-sm sm:text-base">Creator Rewards</p>
              </div>
            </div>

            {/* Videos Grid */}
            <div className="mb-6 sm:mb-8 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold">Featured Videos</h2>
                {videos.length > 0 && (
                  <Badge variant="secondary" className="text-xs sm:text-sm self-start sm:self-auto">
                    {videos.length + 100}+ videos available
                  </Badge>
                )}
              </div>

              {videos.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">No videos yet</h3>
                  <p className="text-muted-foreground mb-6 px-4 text-sm sm:text-base">Be the first to upload a video and earn points!</p>
                  {user && (
                    <Button className="w-full sm:w-auto" asChild>
                      <Link to="/upload">Upload First Video</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">{videos.map((video) => (
                     <VideoCard 
                       key={video.id} 
                       video={video}
                       isUnlocked={userUnlocks.includes(video.id)}
                       onUnlock={() => {
                         setUserUnlocks(prev => [...prev, video.id]);
                         fetchUserUnlocks();
                       }}
                     />
                   ))}
                 </div>
               )}
            </div>
      </main>
    </div>
  );
};

export default Index;
