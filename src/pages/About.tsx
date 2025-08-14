import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Coins, Upload, TrendingUp, Gift, Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            About LockedContent
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            LockedContent is a premium video platform where creativity meets rewards. Discover exclusive content, 
            unlock premium videos with points, and earn rewards by sharing your own creative work.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth">Join Now</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/">Explore Videos</Link>
            </Button>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Upload & Share</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Upload your videos and share your creativity with the community. 
                  Each approved video earns you <Badge variant="secondary">5 points</Badge>
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Coins className="h-12 w-12 text-success mx-auto mb-4" />
                <CardTitle>Earn Points</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Earn points through uploads, gift card redemption, and community engagement. 
                  Use points to unlock premium content.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Video className="h-12 w-12 text-accent mx-auto mb-4" />
                <CardTitle>Unlock Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Unlock premium videos for <Badge variant="secondary">10 points</Badge> each. 
                  Discover exclusive content from talented creators worldwide.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Gift className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Gift Card Redemption</CardTitle>
                <CardDescription>
                  Redeem various gift cards for points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Support for Amazon, Google Play, Apple, Steam, Visa, and PayPal gift cards. 
                  Admin moderation ensures secure transactions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Content Moderation</CardTitle>
                <CardDescription>
                  Quality-assured content through admin review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All uploads and gift card redemptions go through admin review to ensure 
                  platform quality and security.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Creator Rewards</CardTitle>
                <CardDescription>
                  Fair compensation for content creators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Creators earn points for approved uploads and additional rewards 
                  when users unlock their content.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Point System</CardTitle>
                <CardDescription>
                  Simple and transparent economy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fixed pricing: 10 points to unlock videos, 5 points reward for creators. 
                  Clear and consistent point values.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Video className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Premium Content</CardTitle>
                <CardDescription>
                  Exclusive videos from talented creators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Access to curated, high-quality video content that's been reviewed 
                  and approved by our moderation team.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Coins className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Secure Transactions</CardTitle>
                <CardDescription>
                  Safe and reliable point system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All transactions are logged and secure. Points are awarded fairly 
                  and transactions are transparent.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-card p-8 rounded-lg border border-border/50">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join thousands of creators and viewers in our premium video community. 
            Start earning points today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth">Create Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/">Browse Videos</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}