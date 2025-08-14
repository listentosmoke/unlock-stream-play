import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Share2, Gift, Users, Calendar, Eye, Plus } from "lucide-react";
import { format } from "date-fns";

interface Invite {
  id: string;
  invite_code: string;
  // invited_email removed for security - not exposed to regular users
  max_uses: number;
  current_uses: number;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

interface InviteStats {
  totalInvites: number;
  successfulReferrals: number;
  pointsEarned: number;
  activeInvites: number;
}

export default function Invites() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<InviteStats>({
    totalInvites: 0,
    successfulReferrals: 0,
    pointsEarned: 0,
    activeInvites: 0
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [maxUses, setMaxUses] = useState(1);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [invitedEmail, setInvitedEmail] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchInvites();
    fetchStats();
  }, [user, navigate]);

  const fetchInvites = async () => {
    try {
      // Only select safe fields - exclude invited_email for security
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
      toast({
        title: "Error",
        description: "Failed to load invites",
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

      const { data: inviteData, error: inviteError } = await supabase
        .from('invites')
        .select('id, is_active')
        .eq('inviter_id', user!.id);

      if (inviteError) throw inviteError;

      setStats({
        totalInvites: inviteData?.length || 0,
        successfulReferrals: redemptions?.length || 0,
        pointsEarned: redemptions?.reduce((sum, r) => sum + r.inviter_points_awarded, 0) || 0,
        activeInvites: inviteData?.filter(i => i.is_active).length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    if (!user) return;
    
    setCreating(true);
    try {
      // Generate unique invite code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_invite_code');

      if (codeError) throw codeError;

      const expiresAt = expiresIn ? 
        new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString() : 
        null;

      const { error } = await supabase
        .from('invites')
        .insert({
          inviter_id: user.id,
          invite_code: codeData,
          invited_email: invitedEmail || null,
          max_uses: maxUses,
          expires_at: expiresAt
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite created successfully!"
      });

      // Reset form
      setMaxUses(1);
      setExpiresIn(null);
      setInvitedEmail("");
      setShowCreateForm(false);

      // Refresh data
      fetchInvites();
      fetchStats();
    } catch (error) {
      console.error('Error creating invite:', error);
      toast({
        title: "Error",
        description: "Failed to create invite",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const copyInviteLink = (inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/auth?invite=${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard"
    });
  };

  const shareInvite = (inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/auth?invite=${inviteCode}`;
    const text = `Join StreamPlay and get 25 bonus points! Use my invite link: ${inviteUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join StreamPlay',
        text: text,
        url: inviteUrl
      });
    } else {
      // Fallback to copy
      navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Invite message copied to clipboard"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text">Invite Friends</h1>
            <p className="text-muted-foreground mt-2">
              Share StreamPlay with friends and earn points when they join!
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invite
          </Button>
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
              <div className="text-2xl font-bold">{stats.successfulReferrals}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.pointsEarned}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Invites</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeInvites}</div>
            </CardContent>
          </Card>
        </div>

        {/* Create Invite Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Invite</CardTitle>
              <CardDescription>
                Customize your invite settings and share with friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxUses">Maximum Uses</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    min="1"
                    max="100"
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="expiresIn">Expires In (Days)</Label>
                  <Input
                    id="expiresIn"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Never expires"
                    value={expiresIn || ""}
                    onChange={(e) => setExpiresIn(parseInt(e.target.value) || null)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="invitedEmail">Invited Email (Optional)</Label>
                <Input
                  id="invitedEmail"
                  type="email"
                  placeholder="friend@example.com"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={createInvite} disabled={creating}>
                  {creating ? "Creating..." : "Create Invite"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invites List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Invites</CardTitle>
            <CardDescription>
              Manage and share your invitation links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invites created yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create Your First Invite
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {invites.map((invite) => (
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
                          <p>Uses: {invite.current_uses}/{invite.max_uses}</p>
                          <p>Created: {format(new Date(invite.created_at), 'MMM d, yyyy')}</p>
                          {invite.expires_at && (
                            <p>Expires: {format(new Date(invite.expires_at), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invite.invite_code)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(invite.invite_code)}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}