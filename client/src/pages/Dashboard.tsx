import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCricketData } from "@/hooks/use-cricket-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Trophy,
  Users,
  Calendar,
  DollarSign,
  Target,
  BarChart3,
  Play,
  Clock,
  CheckCircle,
  CalendarCheck,
  ArrowRight,
  Bell,
  TrendingUp,
  Edit,
  Trash2,
  MoreHorizontal
} from "lucide-react";

const matchFormSchema = z.object({
  homeTeamId: z.number().min(1, "Please select a team"),
  date: z.string().min(1, "Date is required"),
  venue: z.string().min(1, "Venue is required"),
  opponent: z.string().min(1, "Opponent team is required"),
  matchType: z.string(),
  totalOvers: z.number(),
  matchFee: z.string().min(1, "Match fee is required"),
  status: z.string().default("scheduled"),
});

export default function Dashboard() {
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isQuickScoreDialogOpen, setIsQuickScoreDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const teamId = 1;

  // Helper function to get team names for matches
  const getMatchTitle = (match: any, teams: any[]) => {
    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    // Use opponentName first, fallback to awayTeamName if opponentName is not set
    const opponentName = match.opponentName || match.awayTeamName || 'Away Team';
    return `${homeTeam?.name || 'Home Team'} vs ${opponentName}`;
  };
  
  const { dashboardStats, recentMatches, upcomingMatches, isLoading } = useCricketData(teamId);

  // Force cache invalidation on component mount to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/recent`] });
    queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/upcoming`] });
  }, [teamId]);

  const { data: pendingPayments = [] } = useQuery({
    queryKey: [`/api/teams/${teamId}/payments/pending`],
  });

  const { data: availabilityRequests = [] } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['/api/teams'],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Get team data for display
  const { data: currentTeam } = useQuery({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: () => fetch(`/api/teams/${teamId}`).then(res => res.json()),
  });

  const matchForm = useForm({
    resolver: zodResolver(matchFormSchema),
    defaultValues: {
      homeTeamId: 0, // Will be selected from dropdown
      date: "",
      venue: "",
      status: "scheduled",
      matchType: "T20",
      totalOvers: 20,
      matchFee: "",
      opponent: "",
    },
  });

  const watchedMatchType = matchForm.watch("matchType");

  // Auto-update total overs based on match type
  useState(() => {
    let overs = 20;
    if (watchedMatchType === "T20") overs = 20;
    else if (watchedMatchType === "T25") overs = 25;
    else if (watchedMatchType === "T30") overs = 30;
    else if (watchedMatchType === "ODI") overs = 50;
    else if (watchedMatchType === "Test") overs = 90;
    
    matchForm.setValue("totalOvers", overs);
  });

  const createMatchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/matches", data),
    onSuccess: (_, variables) => {
      // Invalidate queries for the selected team
      const selectedTeamId = variables.homeTeamId;
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/matches/upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/matches/recent`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/dashboard`] });
      setIsScheduleDialogOpen(false);
      matchForm.reset({
        homeTeamId: 0,
        date: "",
        venue: "",
        status: "scheduled",
        matchType: "T20",
        totalOvers: 20,
        matchFee: "",
        opponent: "",
      });
      alert("Match scheduled successfully!");
    },
    onError: (error: any) => {
      console.error("Match creation error:", error);
      const errorMessage = error?.response?.data?.message || error.message || 'Unknown error occurred';
      alert(`Error scheduling match: ${errorMessage}`);
    },
  });

  const updateMatchMutation = useMutation({
    mutationFn: (data: { id: number; updates: any }) => 
      apiRequest("PUT", `/api/matches/${data.id}`, data.updates),
    onSuccess: (_, variables) => {
      // Invalidate queries for the updated team
      const selectedTeamId = variables.updates.homeTeamId;
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/matches/upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/matches/recent`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${selectedTeamId}/dashboard`] });
      setEditingMatch(null);
      matchForm.reset({
        homeTeamId: 0,
        date: "",
        venue: "",
        status: "scheduled",
        matchType: "T20",
        totalOvers: 20,
        matchFee: "",
        opponent: "",
      });
      alert("Match updated successfully!");
    },
    onError: (error: any) => {
      console.error("Match update error:", error);
      const errorMessage = error?.response?.data?.message || error.message || 'Unknown error occurred';
      alert(`Error updating match: ${errorMessage}`);
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: (matchId: number) => apiRequest("DELETE", `/api/matches/${matchId}`),
    onSuccess: () => {
      // Invalidate all match-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/recent`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/dashboard`] });
      queryClient.invalidateQueries({ queryKey: ['cricket-data'] });
      alert("Match deleted successfully!");
    },
    onError: (error: any) => {
      console.error("Match deletion error:", error);
      const errorMessage = error?.response?.data?.message || error.message || 'Unknown error occurred';
      alert(`Error deleting match: ${errorMessage}`);
    },
  });

  const onMatchSubmit = (data: any) => {
    const matchData = {
      homeTeamId: data.homeTeamId,
      // Don't set awayTeamId when using free text opponent names
      opponentName: data.opponent,
      date: data.date,
      venue: data.venue,
      status: data.status || "scheduled",
      matchType: data.matchType,
      totalOvers: data.totalOvers,
      matchFee: data.matchFee,
      tossWinner: null,
      tossDecision: null,
      result: null,
      winnerTeamId: null,
    };
    
    if (editingMatch) {
      updateMatchMutation.mutate({ id: editingMatch.id, updates: matchData });
    } else {
      createMatchMutation.mutate(matchData);
    }
  };

  const handleEditMatch = (match: any) => {
    setEditingMatch(match);
    const dateString = new Date(match.date).toISOString().slice(0, 16);
    matchForm.reset({
      homeTeamId: match.homeTeamId,
      date: dateString,
      venue: match.venue,
      opponent: match.opponentName || "Opponent Team",
      matchType: match.matchType,
      totalOvers: match.totalOvers,
      matchFee: match.matchFee,
      status: match.status,
    });
    setIsScheduleDialogOpen(true);
  };

  const handleDeleteMatch = (matchId: number) => {
    console.log("Deleting match with ID:", matchId);
    deleteMatchMutation.mutate(matchId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats = dashboardStats as any;
  const matches = recentMatches as any[];
  const upcoming = upcomingMatches as any[];
  const requests = availabilityRequests as any[];

  return (
    <div className="space-y-8">
      {/* Header with Quick Actions */}
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">CrickIQ - Cricket Team Management</h1>
          <p className="text-muted-foreground mt-2">
            Smart cricket management platform for {currentTeam?.name || 'your team'}
          </p>
        </div>
        
        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card 
            className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50" 
            onClick={() => setIsScheduleDialogOpen(true)}
          >
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Schedule Match</h3>
                <p className="text-xs text-muted-foreground">Plan new games</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-500/50"
            onClick={() => setIsQuickScoreDialogOpen(true)}
          >
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Live Scoring</h3>
                <p className="text-xs text-muted-foreground">Track matches</p>
              </div>
            </div>
          </Card>
          
          <Link href="/player-management">
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-500/50">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Player Management</h3>
                  <p className="text-xs text-muted-foreground">Team roster</p>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/payments">
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-orange-500/50">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Payments</h3>
                  <p className="text-xs text-muted-foreground">Track finances</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* Team Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matches Won</p>
              <p className="text-2xl font-bold text-green-600">{stats?.matchesWon || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">This season</p>
            </div>
            <Trophy className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Players</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.activePlayers || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Available for selection</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Upcoming Matches</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.upcomingMatches || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Scheduled games</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold text-red-600">{stats?.pendingPayments || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </div>
            <DollarSign className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Match Activity
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Latest games and upcoming fixtures</p>
              </div>
              <Link href="/analytics">
                <Button variant="outline" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {matches && matches.length > 0 ? (
                  matches.slice(0, 4).map((match: any) => (
                    <div key={match.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors gap-3">
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            match.status === 'live' ? 'bg-red-100 text-red-600' :
                            match.status === 'completed' ? 'bg-green-100 text-green-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {match.status === 'live' ? (
                              <Play className="h-5 w-5" />
                            ) : match.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Clock className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {getMatchTitle(match, allTeams as any[])}
                          </p>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                            <span>{new Date(match.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="capitalize">{match.matchType}</span>
                            {match.venue && (
                              <>
                                <span>•</span>
                                <span className="truncate">{match.venue}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                        {match.status === 'live' && (
                          <Badge variant="destructive" className="bg-red-500">
                            <span className="animate-pulse mr-1">●</span> LIVE
                          </Badge>
                        )}
                        {match.status === 'completed' && (
                          <Badge variant={match.winnerTeamId === teamId ? "default" : "secondary"}>
                            {match.winnerTeamId === teamId ? 'Won' : 'Lost'}
                          </Badge>
                        )}
                        {match.status === 'scheduled' && (
                          <Badge variant="outline" className="border-blue-200 text-blue-600">
                            Upcoming
                          </Badge>
                        )}
                        
                        {/* Match Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditMatch(match)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Match
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Match
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Match</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this match? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMatch(match.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Match
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No matches scheduled yet</p>
                    <p className="text-sm">Use "Schedule Match" to plan your first game</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Player Availability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Player Availability
              </CardTitle>
              <p className="text-sm text-muted-foreground">Recent availability requests</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests && requests.length > 0 ? (
                  requests.slice(0, 3).map((request: any) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Match Availability</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.requestDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {request.status || 'Pending'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No availability requests</p>
                  </div>
                )}
                
                <Link href="/availability">
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Manage Availability
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/analytics">
                  <Button variant="ghost" className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Performance Analytics
                  </Button>
                </Link>
                <Link href="/invoices">
                  <Button variant="ghost" className="w-full justify-start">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Invoices & Billing
                  </Button>
                </Link>
                <Link href="/live-scoring">
                  <Button variant="ghost" className="w-full justify-start">
                    <Target className="h-4 w-4 mr-2" />
                    Live Match Scoring
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={(open) => {
        setIsScheduleDialogOpen(open);
        if (!open) {
          setEditingMatch(null);
          matchForm.reset();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMatch ? 'Edit Match' : 'Schedule New Match'}</DialogTitle>
          </DialogHeader>
          <Form {...matchForm}>
            <form onSubmit={matchForm.handleSubmit(onMatchSubmit)} className="space-y-4">
              <FormField
                control={matchForm.control}
                name="homeTeamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Team</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your team" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allTeams.map((team: any) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={matchForm.control}
                name="opponent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opponent Team</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter opponent team name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={matchForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={matchForm.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue</FormLabel>
                    <FormControl>
                      <Input placeholder="Cricket Ground Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={matchForm.control}
                name="matchType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select match type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="T20">T20 (20 overs)</SelectItem>
                        <SelectItem value="T25">T25 (25 overs)</SelectItem>
                        <SelectItem value="T30">T30 (30 overs)</SelectItem>
                        <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                        <SelectItem value="Test">Test Match</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={matchForm.control}
                name="matchFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Fee</FormLabel>
                    <FormControl>
                      <Input placeholder="5000.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsScheduleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMatchMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {createMatchMutation.isPending ? "Scheduling..." : "Schedule Match"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickScoreDialogOpen} onOpenChange={setIsQuickScoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Score Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a match to start scoring or continue live scoring
            </p>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Live Matches</h4>
              <div className="space-y-2">
                {matches && matches.filter((match: any) => match.status === 'live').length > 0 ? (
                  matches.filter((match: any) => match.status === 'live').map((match: any) => (
                    <Link key={match.id} href="/live-scoring">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start bg-green-50 hover:bg-green-100 border-green-200"
                        onClick={() => setIsQuickScoreDialogOpen(false)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {currentTeam?.name || 'Team'} vs Opponent - Live
                      </Button>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No live matches</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Upcoming Matches</h4>
              <div className="space-y-2">
                {upcoming && upcoming.length > 0 ? (
                  upcoming.slice(0, 3).map((match: any) => (
                    <Link key={match.id} href="/live-scoring">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setIsQuickScoreDialogOpen(false)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {currentTeam?.name || 'Team'} vs Opponent - {new Date(match.date).toLocaleDateString()}
                      </Button>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming matches scheduled</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsQuickScoreDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}