import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, User, Video } from 'lucide-react';
import { CaptchaChallenge } from '@/components/auth/CaptchaChallenge';
import { supabase } from '@/integrations/supabase/client';
import { getInviteCookie, clearInviteCookie, hasValidInviteCode } from '@/utils/inviteUtils';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [agreesToTerms, setAgreesToTerms] = useState(false);
  
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      navigate("/");
      return;
    }
    
    // Check for invite code in URL first, then cookies
    const urlInvite = searchParams.get('invite');
    const cookieInvite = getInviteCookie();
    
    const invite = urlInvite || cookieInvite;
    
    if (invite && hasValidInviteCode(invite)) {
      setInviteCode(invite);
      fetchInviterInfo(invite);
    }
  }, [user, navigate, searchParams]);

  const fetchInviterInfo = async (code: string) => {
    try {
      // Use the secure function to get only public inviter info
      const { data, error } = await supabase
        .rpc('get_inviter_public_info', { invite_code_param: code });

      if (!error && data && data.length > 0) {
        const inviterInfo = data[0];
        setInviterName(inviterInfo.display_name || inviterInfo.username || 'Someone');
      }
    } catch (error) {
      console.error('Error fetching inviter info:', error);
    }
  };

  const processInviteRedemption = async (userId: string, retryCount = 0) => {
    if (!inviteCode) return;

    try {
      console.log('Processing invite redemption for user:', userId);
      
      // Get current session to pass auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.log('No session token available, will retry...');
        if (retryCount < 3) {
          setTimeout(() => {
            processInviteRedemption(userId, retryCount + 1);
          }, 1000);
        }
        return;
      }
      
      console.log('Calling process-invite with session token');
      const { data, error } = await supabase.functions.invoke('process-invite', {
        body: { inviteCode },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Invite processing error:', error);
        
        // Retry logic for profile creation delay
        if (error.message?.includes("User profile not found") && retryCount < 3) {
          console.log(`Profile not found, retrying in ${(retryCount + 1) * 1000}ms...`);
          setTimeout(() => {
            processInviteRedemption(userId, retryCount + 1);
          }, (retryCount + 1) * 1000);
          return;
        }
        
        clearInviteCookie();
        toast({
          title: "Invite processing failed",
          description: "Could not process your invite code, but your account was created successfully.",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        clearInviteCookie();
        toast({
          title: "Invite processed!",
          description: `You earned ${data.inviteePointsAwarded} bonus points! ${inviterName} earned ${data.inviterPointsAwarded} points for inviting you.`,
        });
      } else {
        clearInviteCookie();
        toast({
          title: "Invite processing failed",
          description: data?.error || "This invite code is no longer valid.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing invite:', error);
      clearInviteCookie();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !username) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!captchaValid) {
      toast({
        title: "Error",
        description: "Please complete the security check",
        variant: "destructive",
      });
      return;
    }

    if (!agreesToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the Terms of Service and Privacy Policy",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, username);
    
    if (error) {
      // Handle specific error cases
      if (error.message.includes('User already registered')) {
        // User exists, try to sign them in
        const { error: signInError } = await signIn(email, password);
        if (!signInError) {
          // Process invite if present for existing user
          if (inviteCode && user) {
            await processInviteRedemption(user.id);
          }
          
          toast({
            title: "Welcome back!",
            description: inviteCode 
              ? `You're now signed in! ${inviterName ? `Thanks to ${inviterName}, you` : 'You'} earned bonus points!`
              : "You're now signed in",
          });
          navigate('/');
        } else {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      // For new users, wait a moment for the profile to be created, then process invite
      if (inviteCode) {
        setTimeout(async () => {
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            await processInviteRedemption(newUser.id);
          }
        }, 2000); // Increased wait time for profile creation
      }
      
      toast({
        title: "Success!",
        description: inviteCode 
          ? `Welcome to LockedContent! ${inviterName ? `Thanks to ${inviterName}, you` : 'You'} will earn 25 bonus points!`
          : "Account created! You're now signed in.",
      });
      setCaptchaValid(false);
      // Auto-navigate to home
      navigate('/');
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Process invite if present for sign in
      if (inviteCode) {
        // Wait a moment for auth state to settle
        setTimeout(async () => {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await processInviteRedemption(authUser.id);
          }
        }, 500);
      }
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Video className="h-12 w-12 text-primary mr-2" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              LockedContent
            </h1>
          </div>
          <p className="text-muted-foreground">
            {inviteCode 
              ? `${inviterName} invited you to join the premium video streaming platform`
              : 'Join the premium video streaming platform'
            }
          </p>
        </div>

        <Card className="border-border/50 backdrop-blur-sm bg-card/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {inviteCode ? `Welcome to LockedContent!` : 'Welcome'}
            </CardTitle>
            <CardDescription className="text-center">
              {inviteCode 
                ? "Sign up to get 25 bonus points and start watching premium videos"
                : "Sign in to your account or create a new one"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={inviteCode ? "signup" : "signin"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                    variant="default"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <CaptchaChallenge onVerify={setCaptchaValid} className="mb-4" />
                  
                  <div className="flex items-start space-x-2 mb-4">
                    <Checkbox
                      id="terms"
                      checked={agreesToTerms}
                      onCheckedChange={(checked) => setAgreesToTerms(checked as boolean)}
                      className="mt-1"
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed">
                      I agree to the{' '}
                      <Link 
                        to="/terms" 
                        target="_blank"
                        className="text-primary hover:underline font-medium"
                      >
                        Terms of Service
                      </Link>
                      {' '}and{' '}
                      <Link 
                        to="/privacy"
                        target="_blank" 
                        className="text-primary hover:underline font-medium"
                      >
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !captchaValid || !agreesToTerms}
                    variant="default"
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}