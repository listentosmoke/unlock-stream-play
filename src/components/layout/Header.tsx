import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthContext';
import { Video, Coins, Upload, Settings, LogOut, User, Gift, HandCoins } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';

export function Header() {
  const { user, userProfile, signOut } = useAuth();

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <Video className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <span className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LockedContent
          </span>
        </Link>

        {/* User section */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {user ? (
            <>
              {/* Points display - hidden on very small screens */}
              {userProfile && (
                <div className="hidden xs:flex items-center space-x-2 bg-success/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
                  <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
                  <span className="text-xs sm:text-sm font-medium text-success">{userProfile.points}</span>
                </div>
              )}

              {/* Action buttons - responsive sizing */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                  <Link to="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Link>
                </Button>
                
                {/* Mobile upload button - icon only */}
                <Button variant="outline" size="sm" className="sm:hidden p-2" asChild>
                  <Link to="/upload">
                    <Upload className="h-4 w-4" />
                  </Link>
                </Button>
                
                <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                  <Link to="/gift-cards">
                    <Gift className="h-4 w-4 mr-2" />
                    Get Points
                  </Link>
                </Button>

                {/* Mobile gift cards button - icon only */}
                <Button variant="outline" size="sm" className="sm:hidden p-2" asChild>
                  <Link to="/gift-cards">
                    <Gift className="h-4 w-4" />
                  </Link>
                </Button>
                
                <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                  <Link to="/invites">
                    <User className="h-4 w-4 mr-2" />
                    Invite Friends
                  </Link>
                </Button>

                {/* Mobile invites button - icon only */}
                <Button variant="outline" size="sm" className="sm:hidden p-2" asChild>
                  <Link to="/invites">
                    <User className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full">
                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mr-2 sm:mr-0" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {userProfile?.display_name && (
                        <p className="font-medium text-sm">{userProfile.display_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
                    </div>
                  </div>
                  
                  {/* Mobile-only points display */}
                  {userProfile && (
                    <div className="xs:hidden px-2 py-1 border-b">
                      <div className="flex items-center space-x-2 text-sm">
                        <Coins className="h-4 w-4 text-success" />
                        <span className="font-medium text-success">{userProfile.points} Points</span>
                      </div>
                    </div>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/invites">
                      <Gift className="mr-2 h-4 w-4" />
                      Invite Friends
                    </Link>
                  </DropdownMenuItem>
                  {userProfile?.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Settings className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}