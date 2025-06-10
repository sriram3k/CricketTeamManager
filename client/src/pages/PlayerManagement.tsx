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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPlayerSchema, insertPlayerInviteSchema } from "@shared/schema";
import { Plus, Edit, UserX, UserCheck, Trash2, Mail, Send } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const playerFormSchema = insertPlayerSchema.extend({
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
});

const inviteFormSchema = insertPlayerInviteSchema.extend({
  email: z.string().email("Invalid email address"),
  inviterName: z.string().min(1, "Your name is required"),
  teamName: z.string().min(1, "Team name is required"),
});

export default function PlayerManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const teamId = 1; // This would come from user context
  const { toast } = useToast();

  const { data: players, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/players`],
  });

  const { data: invites } = useQuery({
    queryKey: [`/api/teams/${teamId}/invites`],
  });

  const form = useForm({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      userId: 1,
      teamId: teamId,
      name: "",
      position: "",
      jerseyNumber: undefined,
      isActive: true,
    },
  });

  const inviteForm = useForm({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      teamId: teamId,
      email: "",
      inviterName: "Team Manager",
      teamName: "My Cricket Team",
      position: "",
      message: "",
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/players", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/players`] });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/players/${editingPlayer.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/players`] });
      setIsDialogOpen(false);
      setEditingPlayer(null);
      form.reset();
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      try {
        const response = await fetch(`/api/players/${playerId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
      } catch (error) {
        console.error("Delete player error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/players`] });
      toast({
        title: "Player deleted",
        description: "The player has been successfully removed from the team.",
      });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: "Failed to delete player. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/teams/${teamId}/invite`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invites`] });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      toast({
        title: "Invitation sent successfully",
        description: response.emailSent 
          ? `Invitation email sent to ${response.invite.email}`
          : `Invitation created but email could not be sent. The invite is saved in the system.`,
      });
    },
    onError: (error: any) => {
      console.error("Invite mutation error:", error);
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (editingPlayer) {
      updatePlayerMutation.mutate(data);
    } else {
      createPlayerMutation.mutate(data);
    }
  };

  const openEditDialog = (player: any) => {
    setEditingPlayer(player);
    form.reset(player);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPlayer(null);
    form.reset({
      userId: 1,
      teamId: teamId,
      name: "",
      position: "",
      jerseyNumber: undefined,
      isActive: true,
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

  const activePlayersCount = players?.filter((p: any) => p.isActive).length || 0;
  const inactivePlayersCount = players?.filter((p: any) => !p.isActive).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Player Management</h1>
          <p className="text-muted-foreground">Manage your team roster and player information</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  name="jerseyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jersey Number (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter jersey number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
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
                  <Button type="submit" disabled={createPlayerMutation.isPending || updatePlayerMutation.isPending}>
                    {editingPlayer ? "Update Player" : "Add Player"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Players</p>
                <p className="text-2xl font-bold text-foreground">{activePlayersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <UserX className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Inactive Players</p>
                <p className="text-2xl font-bold text-foreground">{inactivePlayersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">B</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Batsmen</p>
                <p className="text-2xl font-bold text-foreground">
                  {players?.filter((p: any) => p.position === 'batsman' && p.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <span className="text-accent-foreground text-xs font-bold">B</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Bowlers</p>
                <p className="text-2xl font-bold text-foreground">
                  {players?.filter((p: any) => p.position === 'bowler' && p.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Players List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {players?.map((player: any) => (
              <div key={player.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    {player.jerseyNumber ? (
                      <span className="font-bold text-foreground">#{player.jerseyNumber}</span>
                    ) : (
                      <span className="font-bold text-muted-foreground">
                        {player.name.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{player.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{player.position}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Badge variant={player.isActive ? "default" : "secondary"}>
                    {player.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(player)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Player</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {player.name} from the team? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePlayerMutation.mutate(player.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={deletePlayerMutation.isPending}
                        >
                          {deletePlayerMutation.isPending ? "Deleting..." : "Delete Player"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            
            {(!players || players.length === 0) && (
              <div className="text-center py-8">
                <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Players Yet</h3>
                <p className="text-muted-foreground">Add your first player to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
