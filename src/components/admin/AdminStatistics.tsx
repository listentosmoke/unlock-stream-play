import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, Video, Coins, Gift, TrendingUp, Activity, Eye, DollarSign } from 'lucide-react';

interface StatsData {
  totalUsers: number;
  totalVideos: number;
  pendingVideos: number;
  approvedVideos: number;
  totalTransactions: number;
  totalPointsCirculation: number;
  totalUnlocks: number;
  totalGiftCards: number;
  pendingGiftCards: number;
  approvedGiftCards: number;
  averageVideoViews: number;
  topUsers: Array<{
    user_id: string;
    display_name?: string;
    username?: string;
    points: number;
    videos_uploaded: number;
  }>;
}

export function AdminStatistics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      // Fetch all statistics in parallel
      const [
        usersResult,
        videosResult,
        pendingVideosResult,
        approvedVideosResult,
        transactionsResult,
        unlocksResult,
        giftCardsResult,
        pendingGiftCardsResult,
        approvedGiftCardsResult,
        topUsersResult
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('videos').select('view_count').eq('status', 'approved'),
        supabase.from('transactions').select('amount'),
        supabase.from('user_unlocks').select('*', { count: 'exact', head: true }),
        supabase.from('gift_cards').select('*', { count: 'exact', head: true }),
        supabase.from('gift_cards').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('gift_cards').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('profiles').select(`
          user_id,
          display_name,
          username,
          points,
          videos:videos(count)
        `).order('points', { ascending: false }).limit(5)
      ]);

      // Calculate total points circulation
      const pointsCirculation = transactionsResult.data?.reduce((sum, transaction) => {
        return sum + Math.abs(transaction.amount);
      }, 0) || 0;

      // Calculate average video views
      const approvedVideosData = approvedVideosResult.data || [];
      const totalViews = approvedVideosData.reduce((sum, video) => sum + (video.view_count || 0), 0);
      const averageViews = approvedVideosData.length > 0 ? Math.round(totalViews / approvedVideosData.length) : 0;

      // Process top users data
      const topUsers = topUsersResult.data?.map(user => ({
        user_id: user.user_id,
        display_name: user.display_name,
        username: user.username,
        points: user.points,
        videos_uploaded: Array.isArray(user.videos) ? user.videos.length : 0
      })) || [];

      setStats({
        totalUsers: usersResult.count || 0,
        totalVideos: videosResult.count || 0,
        pendingVideos: pendingVideosResult.count || 0,
        approvedVideos: approvedVideosData.length,
        totalTransactions: transactionsResult.data?.length || 0,
        totalPointsCirculation: pointsCirculation,
        totalUnlocks: unlocksResult.count || 0,
        totalGiftCards: giftCardsResult.count || 0,
        pendingGiftCards: pendingGiftCardsResult.count || 0,
        approvedGiftCards: approvedGiftCardsResult.count || 0,
        averageVideoViews: averageViews,
        topUsers
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load statistics</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      description: "Registered users",
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Total Videos",
      value: stats.totalVideos,
      description: `${stats.approvedVideos} approved, ${stats.pendingVideos} pending`,
      icon: Video,
      color: "text-purple-600"
    },
    {
      title: "Total Unlocks",
      value: stats.totalUnlocks,
      description: "Videos unlocked by users",
      icon: Eye,
      color: "text-green-600"
    },
    {
      title: "Points Circulation",
      value: stats.totalPointsCirculation,
      description: `From ${stats.totalTransactions} transactions`,
      icon: Coins,
      color: "text-yellow-600"
    },
    {
      title: "Gift Cards",
      value: stats.totalGiftCards,
      description: `${stats.approvedGiftCards} approved, ${stats.pendingGiftCards} pending`,
      icon: Gift,
      color: "text-red-600"
    },
    {
      title: "Avg. Video Views",
      value: stats.averageVideoViews,
      description: "Per approved video",
      icon: TrendingUp,
      color: "text-indigo-600"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Platform Statistics</h2>
        <p className="text-muted-foreground">
          Overview of platform activity and user engagement
        </p>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Top Users by Points
          </CardTitle>
          <CardDescription>
            Most active users on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topUsers.map((user, index) => (
              <div key={user.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.display_name || user.username || 'Anonymous User'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user.videos_uploaded} videos uploaded
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-success font-semibold">
                  <Coins className="h-4 w-4" />
                  {user.points.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platform Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Content Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Approval Rate</span>
              <span className="font-semibold">
                {stats.totalVideos > 0 ? Math.round((stats.approvedVideos / stats.totalVideos) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Review</span>
              <span className="font-semibold text-warning">{stats.pendingVideos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Views</span>
              <span className="font-semibold">{stats.averageVideoViews}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Economy Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Transactions</span>
              <span className="font-semibold">{stats.totalTransactions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Points in Circulation</span>
              <span className="font-semibold text-success">{stats.totalPointsCirculation.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Gift Cards Processed</span>
              <span className="font-semibold">{stats.approvedGiftCards}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}