import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertAvailabilityRequestSchema } from "@shared/schema";
import { Plus, Calendar, Users, CheckCircle, XCircle, Clock, AlertCircle, Trash2, Shield } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const availabilityFormSchema = insertAvailabilityRequestSchema.extend({
  venue: z.string().min(1, "Venue is required"),
  opponent: z.string().min(1, "Opponent is required"),
  matchDate: z.string().min(1, "Match date is required"),
  deadline: z.string().min(1, "Response deadline is required"),
  requestDate: z.string().optional(),
});

type FilterTab = "active" | "expired" | "all";

export default function Availability() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailResponses, setDetailResponses] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("active");
  const [squadMatchId, setSquadMatchId] = useState<number | null>(null);
  const [selectedSquadIds, setSelectedSquadIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();
  const teamId = (user as any)?.teamId || 0;

  const isPlayer = (user as any)?.role === "player";

  const { data: availabilityRequests, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
    enabled: !!teamId,
  });

  const { data: players } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
    enabled: !!teamId,
  });

  // Find the signed-in player's own record (matched by email)
  const currentPlayer = (players as any[])?.find(
    (p: any) => p.email === (user as any)?.email
  );

  const { data: availabilityResponses } = useQuery({
    queryKey: [`/api/availability-responses`],
  });

  const { data: currentSquad = [] } = useQuery({
    queryKey: [`/api/matches/${squadMatchId}/squad`],
    enabled: !!squadMatchId,
  });

  // Track quick-response state per request for the current player
  const [myResponses, setMyResponses] = useState<Record<number, string>>({});

  useEffect(() => {
    if ((currentSquad as any[]).length > 0) {
      setSelectedSquadIds(new Set((currentSquad as any[]).map((s: any) => s.playerId)));
    }
  }, [(currentSquad as any[]).length]);

  useEffect(() => {
    if (!currentPlayer?.id || !(availabilityRequests as any[])?.length) return;
    const fetchResponses = async () => {
      const results: Record<number, string> = {};
      await Promise.all(
        (availabilityRequests as any[]).map(async (req: any) => {
          try {
            const res = await fetch(
              `/api/availability-requests/${req.id}/players/${currentPlayer.id}`,
              { credentials: "include" }
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.status) results[req.id] = data.status;
            }
          } catch (_) {}
        })
      );
      setMyResponses(results);
    };
    fetchResponses();
  }, [currentPlayer?.id, (availabilityRequests as any[])?.length]);

  const form = useForm({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      teamId,
      matchId: undefined,
      requestDate: "",
      matchDate: "",
      venue: "",
      opponent: "",
      deadline: "",
      message: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/availability-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/availability-requests`] });
      setIsDialogOpen(false);
      form.reset({ teamId, matchId: undefined, requestDate: "", matchDate: "", venue: "", opponent: "", deadline: "", message: "" });
      toast({ title: "Request created", description: "Availability request sent to players." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create availability request.", variant: "destructive" });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (requestId: number) => apiRequest("DELETE", `/api/availability-requests/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/availability-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/availability-responses`] });
      toast({ title: "Deleted", description: "Availability request removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete request.", variant: "destructive" });
    },
  });

  const recordResponseMutation = useMutation({
    mutationFn: (data: { requestId: number; playerId: number; status: string }) =>
      apiRequest("POST", "/api/availability-responses", data),
    onSuccess: async (_, variables) => {
      toast({ title: "Response saved", description: "Your availability has been recorded." });
      // Update local quick-response state immediately
      setMyResponses(prev => ({ ...prev, [variables.requestId]: variables.status }));
      queryClient.invalidateQueries({ queryKey: [`/api/availability-responses`] });
      // Refresh detail dialog responses if open
      try {
        const res = await fetch(`/api/availability-requests/${variables.requestId}/responses`, {
          credentials: "include",
        });
        if (res.ok) setDetailResponses(await res.json());
      } catch (_) {}
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to record availability.", variant: "destructive" });
    },
  });

  const saveSquadMutation = useMutation({
    mutationFn: (matchId: number) =>
      apiRequest("POST", `/api/matches/${matchId}/squad`, { playerIds: Array.from(selectedSquadIds) }),
    onSuccess: () => {
      toast({ title: "Squad saved", description: "Playing XI has been confirmed." });
      if (squadMatchId) queryClient.invalidateQueries({ queryKey: [`/api/matches/${squadMatchId}/squad`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save squad.", variant: "destructive" });
    },
  });

  const handleViewDetails = async (request: any) => {
    setSelectedRequest(request);
    setDetailResponses([]);
    setIsDetailsDialogOpen(true);
    // If manager and request is for a specific match, load squad
    if (!isPlayer && request.matchId) {
      setSquadMatchId(request.matchId);
    } else {
      setSquadMatchId(null);
      setSelectedSquadIds(new Set());
    }
    try {
      const res = await fetch(`/api/availability-requests/${request.id}/responses`, {
        credentials: "include",
      });
      if (res.ok) setDetailResponses(await res.json());
    } catch (_) {}
  };

  // Deduplicated responses for a request, filtered to active players only
  const getRequestResponses = (requestId: number) => {
    if (!availabilityResponses) return [];
    const activePlayers = (players as any[]) || [];
    const activePlayerIds = new Set(activePlayers.map((p: any) => p.id));
    const all = (availabilityResponses as any[]).filter(
      r => r.requestId === requestId && activePlayerIds.has(r.playerId)
    );
    const byPlayer = new Map<number, any>();
    for (const r of all) {
      if (!byPlayer.has(r.playerId) || r.id > byPlayer.get(r.playerId).id) {
        byPlayer.set(r.playerId, r);
      }
    }
    return Array.from(byPlayer.values());
  };

  const getResponseCounts = (requestId: number) => {
    const activePlayers = (players as any[]) || [];
    const responses = getRequestResponses(requestId);
    return {
      available: responses.filter((r: any) => r.status === "available").length,
      unavailable: responses.filter((r: any) => r.status === "unavailable").length,
      maybe: responses.filter((r: any) => r.status === "maybe").length,
      pending: activePlayers.length - responses.length,
    };
  };

  const onSubmit = (data: any) => {
    createRequestMutation.mutate({
      ...data,
      teamId,
      requestDate: new Date().toISOString(),
      matchDate: new Date(data.matchDate).toISOString(),
      deadline: new Date(data.deadline).toISOString(),
      matchId: undefined,
    });
  };

  // ---------- derived data ----------
  const allRequests = (availabilityRequests as any[]) || [];
  const now = new Date();

  const filteredRequests = allRequests.filter((r: any) => {
    const expired = new Date(r.deadline) < now;
    if (filterTab === "active") return !expired;
    if (filterTab === "expired") return expired;
    return true;
  });

  // Requests the current user hasn't responded to yet (and not expired)
  const pendingForMe = currentPlayer
    ? allRequests.filter(
        (r: any) => !myResponses[r.id] && new Date(r.deadline) >= now
      )
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading availability requests...</div>
      </div>
    );
  }

  const statusBadgeVariant = (status: string) =>
    status === "available" ? "default" : status === "unavailable" ? "destructive" : "secondary";

  const statusLabel = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Player Availability</h1>
          <p className="text-muted-foreground">Request and track player availability for matches</p>
        </div>
        {!isPlayer && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Availability Request</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="opponent" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opponent</FormLabel>
                      <FormControl><Input placeholder="vs Team Name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="venue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl><Input placeholder="Match venue" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="matchDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Date & Time</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="deadline" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Deadline</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional information for players..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createRequestMutation.isPending}>Send Request</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Pending-for-me banner */}
      {currentPlayer && (pendingForMe as any[]).length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {(pendingForMe as any[]).length} request{(pendingForMe as any[]).length > 1 ? "s" : ""} awaiting your response
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Respond before the deadline so your manager can plan the squad.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Requests</p>
                <p className="text-2xl font-bold text-foreground">
                  {allRequests.filter((r: any) => new Date(r.deadline) >= now).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Players</p>
                <p className="text-2xl font-bold text-foreground">{(players as any[])?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {currentPlayer ? "My Pending" : "Total Requests"}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {currentPlayer
                    ? (pendingForMe as any[]).length
                    : allRequests.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["active", "expired", "all"] as FilterTab[]).map(tab => (
          <Button
            key={tab}
            variant={filterTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTab(tab)}
            className="capitalize"
          >
            {tab}
            <span className="ml-1.5 text-xs opacity-70">
              ({tab === "active"
                ? allRequests.filter((r: any) => new Date(r.deadline) >= now).length
                : tab === "expired"
                ? allRequests.filter((r: any) => new Date(r.deadline) < now).length
                : allRequests.length})
            </span>
          </Button>
        ))}
      </div>

      {/* Availability Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Availability Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRequests.map((request: any) => {
              const isExpired = new Date(request.deadline) < now;
              const counts = getResponseCounts(request.id);
              const myStatus = myResponses[request.id];
              const canStillRespond = !!currentPlayer && !myStatus && !isExpired;

              return (
                <div key={request.id} className={`border rounded-lg p-4 ${isExpired ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{request.opponent}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.matchDate).toLocaleDateString()} at {request.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isExpired ? "secondary" : "default"}>
                        {isExpired ? "Expired" : "Active"}
                      </Badge>
                      {/* Manager delete button */}
                      {!isPlayer && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 w-7 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Availability Request</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete the request for <strong>{request.opponent}</strong> on{" "}
                                {new Date(request.matchDate).toLocaleDateString()}? All player responses
                                will also be removed. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteRequestMutation.mutate(request.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {/* Response counts */}
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Available</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">{counts.available}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Unavailable</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{counts.unavailable}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Maybe</span>
                      </div>
                      <p className="text-lg font-bold text-yellow-600">{counts.maybe}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                      <p className="text-lg font-bold text-gray-500">{Math.max(0, counts.pending)}</p>
                    </div>
                  </div>

                  {/* Quick-response inline buttons — shown for any user with a player record */}
                  {currentPlayer && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-md">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Your response</p>
                      {myStatus ? (
                        <Badge variant={statusBadgeVariant(myStatus)} className="text-sm px-3 py-1">
                          {statusLabel(myStatus)}
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary">Deadline passed — no response recorded</Badge>
                      ) : (
                        <div className="flex gap-2">
                          {["available", "unavailable", "maybe"].map(status => (
                            <Button
                              key={status}
                              size="sm"
                              variant={
                                status === "available" ? "default" :
                                status === "unavailable" ? "destructive" : "outline"
                              }
                              disabled={recordResponseMutation.isPending}
                              onClick={() =>
                                recordResponseMutation.mutate({
                                  requestId: request.id,
                                  playerId: currentPlayer.id,
                                  status,
                                })
                              }
                              className="capitalize"
                            >
                              {status}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(request.deadline).toLocaleDateString()} at{" "}
                      {new Date(request.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(request)}>
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredRequests.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">
                  No {filterTab !== "all" ? filterTab : ""} availability requests
                </h3>
                {!isPlayer && filterTab === "active" && (
                  <p className="text-muted-foreground">Create a request to start tracking player availability</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Availability Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Match</p>
                  <p className="font-medium">{selectedRequest.opponent}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Venue</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.matchDate).toLocaleDateString()} at {selectedRequest.venue}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.deadline).toLocaleDateString()} at{" "}
                    {new Date(selectedRequest.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={new Date(selectedRequest.deadline) < now ? "secondary" : "default"}>
                    {new Date(selectedRequest.deadline) < now ? "Expired" : "Active"}
                  </Badge>
                </div>
              </div>

              {selectedRequest.message && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Message</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.message}</p>
                </div>
              )}

              {/* Squad Selection — managers only, for requests linked to a match */}
              {!isPlayer && squadMatchId && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Playing XI Selection
                    </h3>
                    <Button
                      size="sm"
                      disabled={saveSquadMutation.isPending}
                      onClick={() => saveSquadMutation.mutate(squadMatchId)}
                    >
                      Save Squad ({selectedSquadIds.size})
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select the players who will play. Available players are pre-checked.
                  </p>
                  <div className="space-y-2">
                    {(players as any[])?.map((player: any) => {
                      const response = detailResponses.find((r: any) => r.playerId === player.id);
                      const isAvailable = response?.status === "available";
                      const checked = selectedSquadIds.has(player.id);
                      return (
                        <div key={player.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              setSelectedSquadIds(prev => {
                                const next = new Set(prev);
                                if (val) next.add(player.id);
                                else next.delete(player.id);
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm flex-1">{player.name}</span>
                          {response && (
                            <Badge
                              variant={
                                isAvailable ? "default" :
                                response.status === "unavailable" ? "destructive" : "secondary"
                              }
                              className="text-xs"
                            >
                              {response.status}
                            </Badge>
                          )}
                          {!response && (
                            <Badge variant="outline" className="text-xs">No response</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Player Availability</h3>
                <div className="space-y-2">
                  {(players as any[])?.length > 0 ? (
                    (players as any[]).map((player: any) => {
                      const response = detailResponses.find((r: any) => r.playerId === player.id);
                      const isOwnRow = currentPlayer?.id === player.id;
                      const canEdit = !isPlayer || isOwnRow;
                      // Players can only respond once on own row; managers can re-edit anyone
                      const alreadyResponded = isPlayer && isOwnRow && !!response;
                      const deadlinePassed = new Date(selectedRequest.deadline) < now;

                      return (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{player.name}</p>
                              {isOwnRow && currentPlayer && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            {response ? (
                              <p className="text-xs text-muted-foreground">
                                Responded {new Date(response.responseDate).toLocaleDateString()}
                              </p>
                            ) : canEdit && !deadlinePassed ? (
                              <p className="text-xs text-muted-foreground">No response yet</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Read-only badge: other player's row, or already responded, or deadline passed */}
                            {response && (!canEdit || alreadyResponded || deadlinePassed) && (
                              <Badge variant={statusBadgeVariant(response.status)}>
                                {statusLabel(response.status)}
                              </Badge>
                            )}
                            {!response && !canEdit && (
                              <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                            )}
                            {/* Editable dropdown: manager editing any row, or player editing own row before deadline */}
                            {canEdit && !alreadyResponded && !deadlinePassed && (
                              <Select
                                onValueChange={(value) =>
                                  recordResponseMutation.mutate({
                                    requestId: selectedRequest.id,
                                    playerId: player.id,
                                    status: value,
                                  })
                                }
                                value={response?.status || ""}
                                disabled={recordResponseMutation.isPending}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Set status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="available">Available</SelectItem>
                                  <SelectItem value="unavailable">Unavailable</SelectItem>
                                  <SelectItem value="maybe">Maybe</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {/* Expired — show locked message for editable row with no response */}
                            {canEdit && !response && deadlinePassed && (
                              <Badge variant="secondary">No response</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No players in team yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
