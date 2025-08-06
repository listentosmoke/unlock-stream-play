import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Gift, Coins } from 'lucide-react';

const GIFT_CARD_TYPES = [
  { value: 'amazon', label: 'Amazon Gift Card' },
  { value: 'google_play', label: 'Google Play Gift Card' },
  { value: 'apple', label: 'Apple Gift Card' },
  { value: 'steam', label: 'Steam Gift Card' },
  { value: 'visa', label: 'Visa Gift Card' },
  { value: 'paypal', label: 'PayPal Gift Card' },
];

export function GiftCardRedeem() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    code: '',
    giftCardType: '',
    dollarValue: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to redeem gift cards",
        variant: "destructive",
      });
      return;
    }

    if (!formData.code.trim() || !formData.giftCardType || !formData.dollarValue) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const dollarValue = parseFloat(formData.dollarValue);
    if (isNaN(dollarValue) || dollarValue <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid dollar amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if code already exists
      const { data: existingCard } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('code', formData.code.trim())
        .single();

      if (existingCard) {
        toast({
          title: "Error",
          description: "This gift card code has already been submitted",
          variant: "destructive",
        });
        return;
      }

      // Insert gift card for admin review
      const { error } = await supabase
        .from('gift_cards')
        .insert({
          code: formData.code.trim(),
          gift_card_type: formData.giftCardType as any,
          dollar_value: dollarValue,
          submitted_by: user.id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Gift card submitted for review. Admin will determine point value (10 points = $1).",
      });

      setFormData({ code: '', giftCardType: '', dollarValue: '' });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit gift card",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Redeem Gift Card
        </CardTitle>
        <CardDescription>
          Submit gift card with dollar value. Admin will approve and award points (10 points = $1).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="giftCardType" className="text-sm font-medium">
              Gift Card Type
            </label>
            <Select value={formData.giftCardType} onValueChange={(value) => setFormData(prev => ({ ...prev, giftCardType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select gift card type" />
              </SelectTrigger>
              <SelectContent>
                {GIFT_CARD_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              Gift Card Code
            </label>
            <Input
              id="code"
              placeholder="Enter gift card code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dollarValue" className="text-sm font-medium">
              Gift Card Value (USD)
            </label>
            <Input
              id="dollarValue"
              type="number"
              step="0.01"
              placeholder="Enter dollar amount (e.g., 25.00)"
              value={formData.dollarValue}
              onChange={(e) => setFormData(prev => ({ ...prev, dollarValue: e.target.value }))}
              min="0.01"
              required
            />
            <p className="text-xs text-muted-foreground">
              Admin will convert to points at 10 points = $1
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 mr-2" />
                Submit for Review
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}