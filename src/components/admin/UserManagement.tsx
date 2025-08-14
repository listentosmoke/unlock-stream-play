import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Coins, Video, Eye, Trash2, Edit, Search, UserPlus, Crown, User } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  points: number;
  role: string;
  created_at: string;
  avatar_url?: string;
}

interface UserStats {
  uploadedVideos: number;
  totalUnlocks: number;
  totalSpent: number;
  totalEarned: number;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(profiles || []);
      
      // Fetch stats for each user
      if (profiles) {
        await fetchUserStats(profiles);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async (profiles: UserProfile[]) => {
    const stats: Record<string, UserStats> = {};
    
    for (const profile of profiles) {
      try {
        // Get uploaded videos count
        const { count: uploadedVideos, error: videosError } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('uploader_id', profile.user_id);

        if (videosError) throw videosError;

        // Get unlock transactions (spent)
        const { data: spentTransactions, error: spentError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', profile.user_id)
          .eq('type', 'unlock');

        if (spentError) throw spentError;

        // Get earned transactions (positive rewards, gift cards, referrals)
        const { data: earnedTransactions, error: earnedError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', profile.user_id)
          .in('type', ['reward', 'gift_card', 'referral'])
          .gte('amount', 0); // Only positive amounts

        if (earnedError) throw earnedError;

        // Get total unlocks by this user
        const { count: totalUnlocks, error: unlocksError } = await supabase
          .from('user_unlocks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.user_id);

        if (unlocksError) throw unlocksError;

        const totalSpent = Math.abs(spentTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0);
        const totalEarned = earnedTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

        stats[profile.user_id] = {
          uploadedVideos: uploadedVideos || 0,
          totalUnlocks: totalUnlocks || 0,
          totalSpent,
          totalEarned
        };
      } catch (error) {
        console.error(`Error fetching stats for user ${profile.user_id}:`, error);
        stats[profile.user_id] = {
          uploadedVideos: 0,
          totalUnlocks: 0,
          totalSpent: 0,
          totalEarned: 0
        };
      }
    }
    
    setUserStats(stats);
  };

  const handleUpdateUser = async (userId: string, updates: { display_name?: string; username?: string; role?: 'user' | 'admin' }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      fetchUsers();
      setEditingUser(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Use the database function to safely delete all user data
      const { error: cascadeError } = await supabase.rpc('delete_user_cascade', {
        target_user_id: userId
      });

      if (cascadeError) throw cascadeError;

      // After successful cascade deletion, delete the auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.warn('Auth user deletion failed:', authError);
        toast({
          title: "Partial Success", 
          description: "User data deleted but auth user may still exist. Contact system admin.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "User completely deleted from system",
        });
      }

      fetchUsers();
    } catch (error: any) {
      console.error('Delete user error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleAdjustPoints = async (userId: string, pointsAdjustment: number, description: string) => {
    try {
      // Validation: Prevent invalid point adjustments
      if (!pointsAdjustment || isNaN(pointsAdjustment)) {
        toast({
          title: "Error",
          description: "Invalid point amount entered",
          variant: "destructive",
        });
        return;
      }

      // Get current user points
      const user = users.find(u => u.user_id === userId);
      if (!user) throw new Error('User not found');

      // Calculate new points total
      const newPointsTotal = user.points + pointsAdjustment;

      // Prevent setting negative points
      if (newPointsTotal < 0) {
        toast({
          title: "Error",
          description: `Cannot deduct ${Math.abs(pointsAdjustment)} points. User only has ${user.points} points.`,
          variant: "destructive",
        });
        return;
      }

      // Create transaction record first
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: pointsAdjustment,
          type: pointsAdjustment > 0 ? 'reward' : 'admin_adjustment',
          description: description || `Admin adjustment: ${pointsAdjustment > 0 ? '+' : ''}${pointsAdjustment} points`
        });

      if (transactionError) throw transactionError;

      // Update user points
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ points: newPointsTotal })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: `Points ${pointsAdjustment > 0 ? 'added' : 'deducted'} successfully. New total: ${newPointsTotal}`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Points adjustment error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to adjust points",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and points
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by username, display name, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Unlocks</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Earned</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const stats = userStats[user.user_id];
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.display_name || user.username || 'No name'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.username && user.display_name ? `@${user.username}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {user.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? (
                            <>
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3 mr-1" />
                              User
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-success" />
                          <span className="font-medium">{user.points}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Video className="h-4 w-4 text-primary" />
                          <span>{stats?.uploadedVideos || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 text-accent" />
                          <span>{stats?.totalUnlocks || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-destructive">{stats?.totalSpent || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-success">{stats?.totalEarned || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this user? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {editingUser && (
        <AlertDialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Edit User</AlertDialogTitle>
              <AlertDialogDescription>
                Update user information and manage their account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={editingUser.display_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, display_name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Points Adjustment</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const points = prompt('Enter points to add (positive number):');
                      const pointsNum = Number(points);
                      if (points && !isNaN(pointsNum) && pointsNum > 0) {
                        handleAdjustPoints(editingUser.user_id, pointsNum, 'Admin bonus points');
                      } else if (points) {
                        toast({
                          title: "Error",
                          description: "Please enter a valid positive number",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    + Add Points
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const maxDeduction = editingUser.points;
                      const points = prompt(`Enter points to deduct (max: ${maxDeduction}):`);
                      const pointsNum = Number(points);
                      if (points && !isNaN(pointsNum) && pointsNum > 0) {
                        if (pointsNum > maxDeduction) {
                          toast({
                            title: "Error",
                            description: `Cannot deduct more than ${maxDeduction} points`,
                            variant: "destructive",
                          });
                        } else {
                          handleAdjustPoints(editingUser.user_id, -pointsNum, 'Admin point deduction');
                        }
                      } else if (points) {
                        toast({
                          title: "Error",
                          description: "Please enter a valid positive number",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    - Deduct Points
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current points: {editingUser.points} (cannot go below 0)
                </p>
              </div>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleUpdateUser(editingUser.user_id, {
                  display_name: editingUser.display_name,
                  username: editingUser.username,
                  role: editingUser.role as 'user' | 'admin'
                })}
              >
                Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}