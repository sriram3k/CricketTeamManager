import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, UserX, UserCheck, Trash2, Mail, Send, Users, Award } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const playerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  preferredPosition: z.string().optional(),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  teams: z.array(z.number()).optional(),
});

const inviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  teamId: z.number().min(1, "Please select a team"),
  position: z.string().optional(),
  message: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerFormSchema>;
type InviteFormData = z.infer<typeof inviteFormSchema>;

export default function PlayerManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  // Get all players and user's teams
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["/api/players"],
  });

  const { data: userTeams = [] } = useQuery({
    queryKey: ["/api/teams/manager", (user as any)?.id],
    enabled: !!(user as any)?.id,
  });

  const form = useForm<PlayerFormData>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      preferredPosition: "",
      battingStyle: "",
      bowlingStyle: "",
    },
  });

  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      teamId: undefined,
      position: "",
      message: "",
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: (data: PlayerFormData) => {
      const playerData = {
        ...data,
        teams: selectedTeams.map(teamId => ({ teamId, position: data.preferredPosition }))
      };
      return apiRequest("POST", "/api/players", playerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedTeams([]);
      toast({
        title: "Success",
        description: "Player created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create player",
        variant: "destructive",
      });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: (data: any) => {
      const playerData = {
        ...data,
        teams: selectedTeams.map(teamId => ({ teamId, position: data.preferredPosition }))
      };
      return apiRequest("PUT", `/api/players/${data.id}`, playerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setIsDialogOpen(false);
      setEditingPlayer(null);
      setSelectedTeams([]);
      form.reset();
      toast({
        title: "Success",
        description: "Player updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update player",
        variant: "destructive",
      });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (playerId: number) => apiRequest("DELETE", `/api/players/${playerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      toast({
        title: "Success",
        description: "Player deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete player",
        variant: "destructive",
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => {
      const team = (userTeams as any[]).find((t: any) => t.id === data.teamId);
      const inviteData = {
        email: data.email,
        teamId: data.teamId,
        inviterName: `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || 'Team Manager',
        teamName: team?.name || 'Cricket Team',
        position: data.position,
        message: data.message,
      };
      return apiRequest("POST", "/api/invites/send", inviteData);
    },
    onSuccess: (response: any) => {
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      
      if (response.warning) {
        // Email failed but invitation was created
        toast({
          title: "Invitation Created",
          description: response.message,
          variant: "default",
        });
        
        // Show invitation URL for manual sharing
        setTimeout(() => {
          toast({
            title: "Invitation Link",
            description: `Copy this link to share manually: ${response.invite.inviteUrl}`,
            variant: "default",
          });
        }, 2000);
        
        // Also log to console for easy copying
        console.log("Invitation URL for manual sharing:", response.invite.inviteUrl);
        
      } else {
        // Email sent successfully
        toast({
          title: "Success",
          description: "Player invitation email sent successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PlayerFormData) => {
    if (editingPlayer) {
      updatePlayerMutation.mutate({ ...data, id: editingPlayer.id });
    } else {
      createPlayerMutation.mutate(data);
    }
  };

  const openCreateDialog = () => {
    setEditingPlayer(null);
    setSelectedTeams([]);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (player: any) => {
    setEditingPlayer(player);
    // Set selected teams based on player's current team assignments
    const playerTeamIds = player.teams?.map((t: any) => t.teamId) || [];
    setSelectedTeams(playerTeamIds);
    form.reset({
      name: player.name,
      email: player.email || "",
      phone: player.phone || "",
      preferredPosition: player.preferredPosition || "",
      battingStyle: player.battingStyle || "",
      bowlingStyle: player.bowlingStyle || "",
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading players...</div>
      </div>
    );
  }

  const activePlayersCount = players.filter((p: any) => p.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Player Management</h1>
          <p className="text-muted-foreground">Manage your cricket players and team assignments</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </DialogTrigger>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Player
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlayersCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams Managed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userTeams.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map((player: any) => (
          <Card key={player.id} className="relative group hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{player.name}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(player)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Player</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {player.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePlayerMutation.mutate(player.id)}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deletePlayerMutation.isPending}
                        >
                          {deletePlayerMutation.isPending ? "Deleting..." : "Delete Player"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {player.email && (
                  <p className="text-sm text-muted-foreground">{player.email}</p>
                )}
                {player.preferredPosition && (
                  <Badge variant="secondary">{player.preferredPosition}</Badge>
                )}
                {player.battingStyle && (
                  <p className="text-xs text-muted-foreground">Batting: {player.battingStyle}</p>
                )}
                {player.bowlingStyle && (
                  <p className="text-xs text-muted-foreground">Bowling: {player.bowlingStyle}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Player Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlayer ? "Edit Player" : "Add New Player"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter player name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="preferredPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="batsman">Batsman</SelectItem>
                        <SelectItem value="bowler">Bowler</SelectItem>
                        <SelectItem value="all-rounder">All-rounder</SelectItem>
                        <SelectItem value="wicket-keeper">Wicket-keeper</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="battingStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batting Style</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select batting style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="right-handed">Right-handed</SelectItem>
                        <SelectItem value="left-handed">Left-handed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="bowlingStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bowling Style</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bowling style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="right-arm fast">Right-arm Fast</SelectItem>
                        <SelectItem value="left-arm fast">Left-arm Fast</SelectItem>
                        <SelectItem value="right-arm medium">Right-arm Medium</SelectItem>
                        <SelectItem value="left-arm medium">Left-arm Medium</SelectItem>
                        <SelectItem value="right-arm spin">Right-arm Spin</SelectItem>
                        <SelectItem value="left-arm spin">Left-arm Spin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {userTeams.length > 0 && (
                <div className="space-y-2">
                  <FormLabel>Assign to Teams</FormLabel>
                  <div className="space-y-2">
                    {userTeams.map((team: any) => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTeams([...selectedTeams, team.id]);
                            } else {
                              setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                            }
                          }}
                        />
                        <label htmlFor={`team-${team.id}`} className="text-sm">
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPlayerMutation.isPending || updatePlayerMutation.isPending}
                >
                  {createPlayerMutation.isPending || updatePlayerMutation.isPending
                    ? "Saving..."
                    : editingPlayer
                    ? "Update Player"
                    : "Create Player"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Send Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Player Invitation</DialogTitle>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit((data) => sendInviteMutation.mutate(data))} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="player@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteForm.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team</FormLabel>
                    <FormControl>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                        <SelectContent>
                          {(userTeams as any[]).map((team: any) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteForm.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position (Optional)</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="batsman">Batsman</SelectItem>
                          <SelectItem value="bowler">Bowler</SelectItem>
                          <SelectItem value="all-rounder">All-rounder</SelectItem>
                          <SelectItem value="wicket-keeper">Wicket-keeper</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add a personal message to the invitation..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendInviteMutation.isPending}
                >
                  {sendInviteMutation.isPending ? (
                    <>
                      <Send className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}