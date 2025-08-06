import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, Users, Video, Coins, Gift, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GiftCardModeration } from '@/components/admin/GiftCardModeration';

export default function Admin() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingVideos, setPendingVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not admin - only after loading completes
  useEffect(() => {
    if (loading) return; // Don't redirect while still loading
    
    if (!user) {
      navigate('/auth');
      return;
    }
    if (userProfile && userProfile.role !== 'admin') {
      navigate('/');
      return;
    }
  }, [user, userProfile, navigate, loading]);

  useEffect(() => {
    console.log('Admin - userProfile:', userProfile);
    if (userProfile?.role === 'admin') {
      fetchPendingVideos();
    }
  }, [userProfile]);

  const fetchPendingVideos = async () => {
    try {
      // First get videos
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Then get profiles for uploaders
      if (videos && videos.length > 0) {
        const userIds = videos.map(v => v.uploader_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username, display_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combine data
        const combinedData = videos.map(v => {
          const profile = profiles?.find(p => p.user_id === v.uploader_id);
          return {
            ...v,
            profiles: profile || { username: 'Unknown', display_name: 'Unknown User' }
          };
        });

        setPendingVideos(combinedData);
      } else {
        setPendingVideos([]);
      }
    } catch (error) {
      console.error('Error fetching pending videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoAction = async (videoId: string, action: 'approved' | 'rejected' | 'delete') => {
    try {
      const video = pendingVideos.find(v => v.id === videoId);
      if (!video) return;

      if (action === 'delete') {
        // Delete the video
        const { error: deleteError } = await supabase
          .from('videos')
          .delete()
          .eq('id', videoId);

        if (deleteError) throw deleteError;
      } else {
        // Update video status
        const { error: updateError } = await supabase
          .from('videos')
          .update({ status: action })
          .eq('id', videoId);

        if (updateError) throw updateError;

        // If approved, reward the uploader
        if (action === 'approved') {
          const { error: rewardError } = await supabase
            .from('transactions')
            .insert({
              user_id: video.uploader_id,
              amount: video.reward_points,
              type: 'reward',
              description: `Video approved: ${video.title}`,
              video_id: videoId
            });

          if (rewardError) throw rewardError;

          // Update uploader's points
          const { data: profileData, error: profileFetchError } = await supabase
            .from('profiles')
            .select('points')
            .eq('user_id', video.uploader_id)
            .maybeSingle();

          if (profileFetchError) throw profileFetchError;

          const currentPoints = profileData?.points || 0;
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ points: currentPoints + video.reward_points })
            .eq('user_id', video.uploader_id);

          if (profileUpdateError) throw profileUpdateError;
        }
      }

      toast({
        title: "Success",
        description: action === 'delete' ? "Video deleted successfully" : `Video ${action} successfully`,
      });

      fetchPendingVideos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} video`,
        variant: "destructive",
      });
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading admin panel...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage video submissions and moderate content
          </p>
        </div>

        <Tabs defaultValue="giftcards" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Videos ({pendingVideos.length})
            </TabsTrigger>
            <TabsTrigger value="giftcards" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Gift Cards
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            {pendingVideos.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Video className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No pending videos</h3>
                  <p className="text-muted-foreground text-center">
                    All videos have been reviewed. Check back later for new submissions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingVideos.map((video) => (
                  <Card key={video.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{video.title}</CardTitle>
                          <CardDescription className="mt-1">
                            Uploaded by {video.profiles?.display_name || video.profiles?.username || 'Unknown User'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {video.description && (
                        <p className="text-muted-foreground">{video.description}</p>
                      )}
                      
                      {video.full_video_url && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Video Preview</label>
                          <video 
                            src={video.full_video_url} 
                            controls 
                            className="w-full max-w-md rounded border"
                            style={{ maxHeight: '200px' }}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-warning" />
                          Unlock Cost: {video.unlock_cost} points
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-success" />
                          Creator Reward: {video.reward_points} points
                        </span>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          onClick={() => handleVideoAction(video.id, 'approved')}
                          className="bg-success hover:bg-success/90"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleVideoAction(video.id, 'rejected')}
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleVideoAction(video.id, 'delete')}
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="giftcards" className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Gift Card Moderation</h2>
              <p className="text-muted-foreground">
                Review and approve gift card submissions to award points to users.
              </p>
            </div>
            <GiftCardModeration />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingVideos.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Videos awaiting approval
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    All approved videos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Registered users
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}