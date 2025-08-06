import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User, Coins, Edit, Save, X } from 'lucide-react';

export default function Profile() {
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    username: '',
    display_name: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (userProfile) {
      setFormData({
        username: userProfile.username || '',
        display_name: userProfile.display_name || ''
      });
      fetchTransactions();
    }
  }, [user, userProfile, navigate]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          display_name: formData.display_name
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();
      setEditing(false);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        username: userProfile.username || '',
        display_name: userProfile.display_name || ''
      });
    }
    setEditing(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'reward':
        return '🎉';
      case 'unlock':
        return '🔓';
      case 'gift_card':
        return '🎁';
      default:
        return '💰';
    }
  };

  if (!user || !userProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Profile Header */}
          <div className="text-center">
            <User className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">My Profile</h1>
            <p className="text-muted-foreground">
              Manage your account settings and view your activity
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Profile Information</CardTitle>
                  {!editing ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={user.email || ''} disabled />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    disabled={!editing}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input 
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    disabled={!editing}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                    {userProfile.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Points Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-success" />
                  Points Summary
                </CardTitle>
                <CardDescription>
                  Your current points and recent transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-6 bg-success/10 rounded-lg">
                  <Coins className="h-12 w-12 text-success mx-auto mb-2" />
                  <div className="text-3xl font-bold text-success">{userProfile.points}</div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ ${(userProfile.points / 10).toFixed(2)} USD value
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Recent Transactions</h4>
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No transactions yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getTransactionIcon(transaction.type)}</span>
                            <div>
                              <p className="text-sm font-medium">{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(transaction.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${transaction.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}