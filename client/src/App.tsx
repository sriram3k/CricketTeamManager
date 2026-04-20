import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import PlayerDashboard from "@/pages/PlayerDashboard";
import LiveScoring from "@/pages/LiveScoring";
import PlayerManagement from "@/pages/PlayerManagement";
import TeamManagement from "@/pages/TeamManagement";
import Availability from "@/pages/Availability";
import Analytics from "@/pages/Analytics";
import Schedule from "@/pages/Schedule";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AppLayout from "@/components/layout/AppLayout";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import TourRestartButton from "@/components/onboarding/TourRestartButton";

function Router() {
  const { isAuthenticated, isLoading, isPlayer, user } = useAuth();
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    // Check if user has completed the tour
    const tourCompleted = localStorage.getItem('cricmanager-tour-completed');
    if (!tourCompleted && isAuthenticated) {
      // Start tour after a short delay
      setTimeout(() => setIsTourOpen(true), 1000);
    }
  }, [isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show authentication pages if not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Show role-based application content
  return (
    <AppLayout>
      <Switch>
        {isPlayer ? (
          // Player routes - restricted access
          <>
            <Route path="/" component={PlayerDashboard} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/availability" component={Availability} />
            <Route component={NotFound} />
          </>
        ) : (
          // Manager routes - full access
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/live-scoring" component={LiveScoring} />
            <Route path="/team-management" component={TeamManagement} />
            <Route path="/player-management" component={PlayerManagement} />
            <Route path="/availability" component={Availability} />
            <Route path="/analytics" component={Analytics} />
            <Route component={NotFound} />
          </>
        )}
      </Switch>
      <OnboardingTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
      <TourRestartButton />
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
