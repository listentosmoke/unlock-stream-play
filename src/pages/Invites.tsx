import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Share2, Users } from "lucide-react";
import { format } from "date-fns";

interface Invite {
  id: string;
  invite_code: string;
  max_uses: number;
  current_uses: number;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

interface InviteStats {
  totalRedemptions: number;
  totalPointsEarned: number;
}

export default function Invites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [userInvite, setUserInvite] = useState<Invite | null>(null);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([fetchUserInvite(), fetchStats()]);
    } else {
      navigate('/auth');
    }
  }, [user, navigate]);

  const fetchUserInvite = async () => {
    try {
      // Get the user's unique permanent invite
      const { data, error } = await supabase
        .from('invites')
        .select(`
          id,
          invite_code,
          max_uses,
          current_uses,
          expires_at,
          created_at,
          is_active
        `)
        .eq('inviter_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setUserInvite(data || null);
    } catch (error) {
      console.error('Error fetching user invite:', error);
      toast({
        title: "Error",
        description: "Failed to load your invite link",
        variant: "destructive"
      });
    }
  };

  const fetchStats = async () => {
    try {
      // Get invite statistics
      const { data: redemptions, error: redemptionsError } = await supabase
        .from('invite_redemptions')
        .select('inviter_points_awarded')
        .eq('inviter_id', user!.id);

      if (redemptionsError) throw redemptionsError;

      setStats({
        totalRedemptions: redemptions?.length || 0,
        totalPointsEarned: redemptions?.reduce((sum, r) => sum + r.inviter_points_awarded, 0) || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!userInvite) return;
    
    const inviteUrl = `${window.location.origin}?invite=${userInvite.invite_code}`;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Success",
        description: "Invite link copied to clipboard!"
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy invite link",
        variant: "destructive"
      });
    }
  };

  const shareInvite = async () => {
    if (!userInvite) return;
    
    const inviteUrl = `${window.location.origin}?invite=${userInvite.invite_code}`;
    const shareText = `Join me on this awesome platform! Use my invite link: ${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me!',
          text: shareText,
          url: inviteUrl
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to clipboard
          copyInviteLink();
        }
      }
    } else {
      // Fallback to clipboard copy
      copyInviteLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Your Invite Link
            </h1>
            <p className="text-muted-foreground text-lg">
              Share your unique invite link and earn points for each successful referral
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {userInvite?.current_uses || 0}
                </div>
                <div className="text-sm text-blue-600/70 dark:text-blue-400/70 font-medium">
                  People Invited
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats?.totalRedemptions || 0}
                </div>
                <div className="text-sm text-green-600/70 dark:text-green-400/70 font-medium">
                  Successful Referrals
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats?.totalPointsEarned || 0}
                </div>
                <div className="text-sm text-purple-600/70 dark:text-purple-400/70 font-medium">
                  Points Earned
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Your Unique Invite Link */}
          {userInvite ? (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Your Unique Invite Link</h3>
                  <p className="text-muted-foreground">
                    Share this link with friends to earn referral points
                  </p>
                  
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <code className="flex-1 px-3 py-2 bg-background rounded font-mono text-sm break-all">
                        {`${window.location.origin}?invite=${userInvite.invite_code}`}
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button onClick={copyInviteLink}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button variant="outline" onClick={shareInvite}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t border-muted">
                    <p>Invite Code: <code className="px-2 py-1 bg-muted rounded font-mono">{userInvite.invite_code}</code></p>
                    <p>Total Uses: {userInvite.current_uses}</p>
                    <p>Created: {format(new Date(userInvite.created_at), 'MMM d, yyyy')}</p>
                    <p>Status: <Badge variant="default" className="ml-1">Active</Badge></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Loading your invite link...</h3>
                <p className="text-muted-foreground">
                  Please wait while we set up your unique invite link
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}