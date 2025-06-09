import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import LiveScoring from "@/pages/LiveScoring";
import PlayerManagement from "@/pages/PlayerManagement";
import Availability from "@/pages/Availability";
import Payments from "@/pages/Payments";
import Invoices from "@/pages/Invoices";
import Analytics from "@/pages/Analytics";
import AppLayout from "@/components/layout/AppLayout";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/live-scoring" component={LiveScoring} />
        <Route path="/players" component={PlayerManagement} />
        <Route path="/availability" component={Availability} />
        <Route path="/payments" component={Payments} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/analytics" component={Analytics} />
        <Route component={NotFound} />
      </Switch>
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
