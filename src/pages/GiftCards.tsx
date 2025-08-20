import { Header } from '@/components/layout/Header';
import { GiftCardRedeem } from '@/components/gift-cards/GiftCardRedeem';
import { GiftCardHistory } from '@/components/gift-cards/GiftCardHistory';
import { useAuth } from '@/components/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Gift, HandCoins } from 'lucide-react';

export default function GiftCards() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <HandCoins className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Get Points</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Redeem gift card codes or invite friends to earn points. Submit your gift cards for admin review and get points added to your account once approved.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="flex justify-center">
            <GiftCardRedeem />
          </div>
          <div>
            <GiftCardHistory />
          </div>
        </div>
      </main>
    </div>
  );
}