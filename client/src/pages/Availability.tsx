import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertAvailabilityRequestSchema } from "@shared/schema";
import { Plus, Calendar, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const availabilityFormSchema = insertAvailabilityRequestSchema.extend({
  venue: z.string().min(1, "Venue is required"),
  opponent: z.string().min(1, "Opponent is required"),
  // Override timestamp fields to accept plain strings from datetime-local inputs
  matchDate: z.string().min(1, "Match date is required"),
  deadline: z.string().min(1, "Response deadline is required"),
  requestDate: z.string().optional(),
});

export default function Availability() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailResponses, setDetailResponses] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const teamId = (user as any)?.teamId || 0;

  // Check if user is a player (role-based access control)
  const isPlayer = user?.role === "player";

  const { data: availabilityRequests, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
    enabled: !!teamId,
  });

  const { data: players } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
    enabled: !!teamId,
  });

  const { data: availabilityResponses } = useQuery({
    queryKey: [`/api/availability-responses`],
  });

  const form = useForm({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      teamId: teamId,
      matchId: null,
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
      form.reset({ teamId, matchId: null, requestDate: "", matchDate: "", venue: "", opponent: "", deadline: "", message: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create availability request.", variant: "destructive" });
    },
  });

  const recordResponseMutation = useMutation({
    mutationFn: (data: { requestId: number; playerId: number; status: string }) =>
      apiRequest("POST", "/api/availability-responses", data),
    onSuccess: async (_, variables) => {
      toast({ title: "Availability recorded", description: "Player availability has been saved." });
      try {
        const res = await fetch(`/api/availability-requests/${variables.requestId}/responses`, {
          credentials: "include",
        });
        if (res.ok) {
          setDetailResponses(await res.json());
        }
      } catch (err) {
        console.error("Failed to refresh responses:", err);
      }
    },
    onError: (error) => {
      console.error("Record availability error:", error);
      toast({ title: "Error", description: "Failed to record availability.", variant: "destructive" });
    },
  });

  const handleViewDetails = async (request: any) => {
    setSelectedRequest(request);
    setDetailResponses([]);
    setIsDetailsDialogOpen(true);
    try {
      const res = await fetch(`/api/availability-requests/${request.id}/responses`, {
        credentials: "include",
      });
      if (res.ok) {
        setDetailResponses(await res.json());
      }
    } catch (error) {
      console.error("Error fetching request details:", error);
    }
  };

  // Get responses for a specific request, deduplicated by player (latest wins),
  // filtered to only active team members
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

  // Get response counts for a request
  const getResponseCounts = (requestId: number) => {
    const activePlayers = (players as any[]) || [];
    const responses = getRequestResponses(requestId);
    return {
      available: responses.filter((r: any) => r.status === 'available').length,
      unavailable: responses.filter((r: any) => r.status === 'unavailable').length,
      maybe: responses.filter((r: any) => r.status === 'maybe').length,
      pending: activePlayers.length - responses.length
    };
  };

  const onSubmit = (data: any) => {
    createRequestMutation.mutate({
      ...data,
      teamId,
      requestDate: new Date().toISOString(),
      matchDate: new Date(data.matchDate).toISOString(),
      deadline: new Date(data.deadline).toISOString(),
      matchId: null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading availability requests...</div>
      </div>
    );
  }

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
                <FormField
                  control={form.control}
                  name="opponent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opponent</FormLabel>
                      <FormControl>
                        <Input placeholder="vs Team Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl>
                        <Input placeholder="Match venue" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="matchDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Deadline</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional information for players..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRequestMutation.isPending}>
                    Send Request
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        )}
      </div>

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
                  {availabilityRequests?.filter((r: any) => new Date(r.deadline) > new Date()).length || 0}
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
                <p className="text-2xl font-bold text-foreground">{players?.length || 0}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Avg Response Rate</p>
                <p className="text-2xl font-bold text-foreground">85%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Availability Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Availability Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availabilityRequests?.map((request: any) => {
              const isExpired = new Date(request.deadline) < new Date();
              const counts = getResponseCounts(request.id);
              
              return (
                <div key={request.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{request.opponent}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.matchDate).toLocaleDateString()} at {request.venue}
                      </p>
                    </div>
                    <Badge variant={isExpired ? "secondary" : "default"}>
                      {isExpired ? "Expired" : "Active"}
                    </Badge>
                  </div>
                  
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
                        <Clock className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                      <p className="text-lg font-bold text-gray-600">{counts.pending}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(request.deadline).toLocaleDateString()} at{" "}
                      {new Date(request.deadline).toLocaleTimeString()}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(request)}>
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {(!availabilityRequests || availabilityRequests.length === 0) && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Availability Requests</h3>
                <p className="text-muted-foreground">Create your first availability request to get started</p>
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
                    {new Date(selectedRequest.deadline).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={new Date(selectedRequest.deadline) < new Date() ? "secondary" : "default"}>
                    {new Date(selectedRequest.deadline) < new Date() ? "Expired" : "Active"}
                  </Badge>
                </div>
              </div>

              {selectedRequest.message && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Message</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.message}</p>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Player Availability</h3>
                <div className="space-y-2">
                  {players && players.length > 0 ? (
                    players.map((player: any) => {
                      const response = detailResponses.find((r: any) => r.playerId === player.id);
                      return (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <p className="font-medium">{player.name}</p>
                            {response && (
                              <p className="text-xs text-muted-foreground">
                                Responded {new Date(response.responseDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {response && (
                              <Badge
                                variant={
                                  response.status === 'available' ? 'default' :
                                  response.status === 'unavailable' ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {response.status.charAt(0).toUpperCase() + response.status.slice(1)}
                              </Badge>
                            )}
                            <Select
                              onValueChange={(value) =>
                                recordResponseMutation.mutate({
                                  requestId: selectedRequest.id,
                                  playerId: player.id,
                                  status: value,
                                })
                              }
                              value={response?.status || ""}
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
