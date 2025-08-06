import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, Gift, Coins } from 'lucide-react';

const GIFT_CARD_TYPE_LABELS = {
  amazon: 'Amazon',
  google_play: 'Google Play',
  apple: 'Apple',
  steam: 'Steam',
  visa: 'Visa',
  paypal: 'PayPal',
};

export function GiftCardModeration() {
  const { toast } = useToast();
  const [pendingGiftCards, setPendingGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingGiftCards();
  }, []);

  const fetchPendingGiftCards = async () => {
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          profiles!gift_cards_submitted_by_fkey(username, display_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingGiftCards(data || []);
    } catch (error) {
      console.error('Error fetching pending gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGiftCardAction = async (giftCardId: string, action: 'approved' | 'rejected') => {
    try {
      const giftCard = pendingGiftCards.find(g => g.id === giftCardId);
      if (!giftCard) return;

      // Update gift card status
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({ 
          status: action,
          redeemed_by: action === 'approved' ? giftCard.submitted_by : null,
          redeemed_at: action === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', giftCardId);

      if (updateError) throw updateError;

      // If approved, reward the user with points
      if (action === 'approved') {
        // Create transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: giftCard.submitted_by,
            amount: giftCard.points_value,
            type: 'gift_card' as any,
            description: `Gift card redeemed: ${GIFT_CARD_TYPE_LABELS[giftCard.gift_card_type as keyof typeof GIFT_CARD_TYPE_LABELS]} (${giftCard.code.substring(0, 4)}...)`
          });

        if (transactionError) throw transactionError;

        // Update user's points
        const { data: profileData, error: profileFetchError } = await supabase
          .from('profiles')
          .select('points')
          .eq('user_id', giftCard.submitted_by)
          .single();

        if (profileFetchError) throw profileFetchError;

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ points: (profileData.points || 0) + giftCard.points_value })
          .eq('user_id', giftCard.submitted_by);

        if (profileUpdateError) throw profileUpdateError;
      }

      toast({
        title: "Success",
        description: `Gift card ${action} successfully`,
      });

      fetchPendingGiftCards();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} gift card`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingGiftCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gift className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No pending gift cards</h3>
            <p className="text-muted-foreground text-center">
              All gift cards have been reviewed. Check back later for new submissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingGiftCards.map((giftCard) => (
            <Card key={giftCard.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {GIFT_CARD_TYPE_LABELS[giftCard.gift_card_type as keyof typeof GIFT_CARD_TYPE_LABELS]} Gift Card
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Submitted by {giftCard.profiles?.display_name || giftCard.profiles?.username || 'Unknown User'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Gift Card Code</label>
                    <div className="font-mono bg-muted p-3 rounded border">
                      {giftCard.code}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Requested Points</label>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-warning" />
                      <span className="font-semibold">{giftCard.points_value} points</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Submitted on {new Date(giftCard.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => handleGiftCardAction(giftCard.id, 'approved')}
                    className="bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Award Points
                  </Button>
                  <Button
                    onClick={() => handleGiftCardAction(giftCard.id, 'rejected')}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}