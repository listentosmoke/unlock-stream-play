import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Gift, Clock, CheckCircle, XCircle } from 'lucide-react';

const GIFT_CARD_TYPE_LABELS = {
  amazon: 'Amazon',
  google_play: 'Google Play',
  apple: 'Apple',
  steam: 'Steam',
  visa: 'Visa',
  paypal: 'PayPal',
};

export function GiftCardHistory() {
  const { user } = useAuth();
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGiftCards();
    }
  }, [user]);

  const fetchGiftCards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGiftCards(data || []);
    } catch (error) {
      console.error('Error fetching gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Gift Card History
        </CardTitle>
        <CardDescription>
          View your submitted gift cards and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {giftCards.length === 0 ? (
          <div className="text-center py-8">
            <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No gift cards submitted yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {giftCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(card.status)}
                  <div>
                    <p className="font-medium">
                      {GIFT_CARD_TYPE_LABELS[card.gift_card_type as keyof typeof GIFT_CARD_TYPE_LABELS]} Gift Card
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Code: {card.code.substring(0, 4)}...{card.code.substring(card.code.length - 4)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card.points_value} points • {new Date(card.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant={getStatusVariant(card.status)}>
                  {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}