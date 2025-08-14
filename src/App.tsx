import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthContext";
import { setInviteCookie, hasValidInviteCode } from "@/utils/inviteUtils";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";
import GiftCards from "./pages/GiftCards";
import About from "./pages/About";
import Profile from "./pages/Profile";
import Video from "./pages/Video";
import Invites from "./pages/Invites";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

// Component to handle invite redirection
const InviteHandler = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const inviteCode = searchParams.get('invite');
    
    if (inviteCode && hasValidInviteCode(inviteCode)) {
      // Store invite code in secure cookie
      setInviteCookie(inviteCode);
      
      // Redirect to auth page, removing invite from URL
      if (location.pathname !== '/auth') {
        window.location.href = '/auth';
        return;
      }
    }
  }, [location]);

  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <InviteHandler>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/gift-cards" element={<GiftCards />} />
              <Route path="/about" element={<About />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/invites" element={<Invites />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/video/:id" element={<Video />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </InviteHandler>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
