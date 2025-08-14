import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Users, TrendingUp, Clock, Search, Eye, Ban } from "lucide-react";
import { format } from "date-fns";

interface InviteData {
  id: string;
  invite_code: string;
  invited_email?: string;
  max_uses: number;
  current_uses: number;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
  inviter: {
    username?: string;
    display_name?: string;
    email: string;
  };
}

interface RedemptionData {
  id: string;
  inviter_points_awarded: number;
  invitee_points_awarded: number;
  redeemed_at: string;
  inviter: {
    username?: string;
    display_name?: string;
  };
  invitee: {
    username?: string;
    display_name?: string;
  };
  invite: {
    invite_code: string;
  };
}

interface InviteStats {
  totalInvites: number;
  totalRedemptions: number;
  totalPointsAwarded: number;
  activeInvites: number;
  topInviters: Array<{
    user_id: string;
    username?: string;
    display_name?: string;
    invite_count: number;
    redemption_count: number;
    points_earned: number;
  }>;
}

export default function InviteManagement() {
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionData[]>([]);
  const [stats, setStats] = useState<InviteStats>({
    totalInvites: 0,
    totalRedemptions: 0,
    totalPointsAwarded: 0,
    activeInvites: 0,
    topInviters: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchInvites(),
        fetchRedemptions(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching invite data:', error);
      toast({
        title: "Error",
        description: "Failed to load invite data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select(`
        *,
        profiles!invites_inviter_id_fkey(username, display_name, user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    setInvites(data?.map(invite => ({
      ...invite,
      inviter: {
        username: invite.profiles?.username,
        display_name: invite.profiles?.display_name,
        email: '' // We don't have email access from profiles
      }
    })) || []);
  };

  const fetchRedemptions = async () => {
    const { data, error } = await supabase
      .from('invite_redemptions')
      .select(`
        *,
        inviter:profiles!invite_redemptions_inviter_id_fkey(username, display_name),
        invitee:profiles!invite_redemptions_invitee_id_fkey(username, display_name),
        invite:invites!invite_redemptions_invite_id_fkey(invite_code)
      `)
      .order('redeemed_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    setRedemptions(data || []);
  };

  const fetchStats = async () => {
    // Get basic stats
    const [invitesResult, redemptionsResult] = await Promise.all([
      supabase.from('invites').select('id, is_active'),
      supabase.from('invite_redemptions').select('inviter_points_awarded, invitee_points_awarded, inviter_id')
    ]);

    if (invitesResult.error || redemptionsResult.error) {
      throw new Error('Failed to fetch stats');
    }

    const totalPointsAwarded = redemptionsResult.data?.reduce((sum, r) => 
      sum + r.inviter_points_awarded + r.invitee_points_awarded, 0) || 0;

    // Calculate top inviters from redemptions data
    const inviterStats = new Map();
    redemptionsResult.data?.forEach(redemption => {
      const inviterId = redemption.inviter_id;
      if (!inviterStats.has(inviterId)) {
        inviterStats.set(inviterId, {
          user_id: inviterId,
          redemption_count: 0,
          points_earned: 0
        });
      }
      const stats = inviterStats.get(inviterId);
      stats.redemption_count++;
      stats.points_earned += redemption.inviter_points_awarded;
    });

    const topInviters = Array.from(inviterStats.values())
      .sort((a, b) => b.redemption_count - a.redemption_count)
      .slice(0, 10);

    setStats({
      totalInvites: invitesResult.data?.length || 0,
      totalRedemptions: redemptionsResult.data?.length || 0,
      totalPointsAwarded,
      activeInvites: invitesResult.data?.filter(i => i.is_active).length || 0,
      topInviters
    });
  };

  const toggleInviteStatus = async (inviteId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('invites')
        .update({ is_active: !currentStatus })
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invite ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });

      fetchInvites();
    } catch (error) {
      console.error('Error toggling invite status:', error);
      toast({
        title: "Error",
        description: "Failed to update invite status",
        variant: "destructive"
      });
    }
  };

  const filteredInvites = invites.filter(invite =>
    invite.invite_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invite.inviter.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invite.inviter.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRedemptions = redemptions.filter(redemption =>
    redemption.invite.invite_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    redemption.inviter.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    redemption.invitee.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">Invite Management</h3>
          <p className="text-muted-foreground">Monitor and manage the referral system</p>
        </div>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invites, users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-80"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvites}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRedemptions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Distributed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalPointsAwarded}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Invites</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeInvites}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invites">All Invites</TabsTrigger>
          <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
          <TabsTrigger value="leaderboard">Top Inviters</TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Manage all invitation codes in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredInvites.map((invite) => (
                  <div key={invite.id} className="border rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {invite.invite_code}
                          </code>
                          <Badge variant={invite.is_active ? "default" : "secondary"}>
                            {invite.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Inviter: {invite.inviter.display_name || invite.inviter.username || 'Unknown'}
                          </p>
                          <p>Uses: {invite.current_uses}/{invite.max_uses}</p>
                          <p>Created: {format(new Date(invite.created_at), 'MMM d, yyyy HH:mm')}</p>
                          {invite.expires_at && (
                            <p>Expires: {format(new Date(invite.expires_at), 'MMM d, yyyy')}</p>
                          )}
                          {invite.invited_email && (
                            <p>For: {invite.invited_email}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleInviteStatus(invite.id, invite.is_active)}
                        >
                          {invite.is_active ? (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredInvites.length === 0 && (
                  <div className="text-center py-8">
                    <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No invites found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Redemptions</CardTitle>
              <CardDescription>Track successful invite redemptions and point awards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRedemptions.map((redemption) => (
                  <div key={redemption.id} className="border rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {redemption.invite.invite_code}
                          </code>
                          <Badge variant="default">Redeemed</Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Inviter: {redemption.inviter.display_name || redemption.inviter.username || 'Unknown'} 
                            <span className="text-green-600 ml-2">(+{redemption.inviter_points_awarded} points)</span>
                          </p>
                          <p>
                            Invitee: {redemption.invitee.display_name || redemption.invitee.username || 'Unknown'}
                            <span className="text-green-600 ml-2">(+{redemption.invitee_points_awarded} points)</span>
                          </p>
                          <p>Redeemed: {format(new Date(redemption.redeemed_at), 'MMM d, yyyy HH:mm')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredRedemptions.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No redemptions found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Inviters</CardTitle>
              <CardDescription>Users with the most successful referrals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.topInviters.map((inviter, index) => (
                  <div key={inviter.user_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">
                            {inviter.display_name || inviter.username || 'Unknown User'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {inviter.invite_count} invites • {inviter.redemption_count} successful
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{inviter.points_earned} points</p>
                        <p className="text-sm text-muted-foreground">earned</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {stats.topInviters.length === 0 && (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No inviter data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}