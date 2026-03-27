import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeamSchema, type Team, type InsertTeam } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit2, Users, MapPin, Calendar, Globe, Phone, Mail, Trophy, Palette, Trash2, MoreVertical, Link2, Copy, Check } from "lucide-react";
import { useLocation } from "wouter";
import { z } from "zod";

const teamFormSchema = insertTeamSchema.extend({
  foundedYear: z.number().optional(),
  teamColor: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamFormSchema>;

export default function TeamManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [joinLinkDialog, setJoinLinkDialog] = useState<{ teamName: string; joinUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Fetch teams for the current user (manager)
  const { data: teams = [], isLoading, error } = useQuery<Team[]>({
    queryKey: ["/api/teams/manager", (user as any)?.id],
    queryFn: () => {
      if (!(user as any)?.id) return [];
      return fetch(`/api/teams/manager/${(user as any).id}`).then(res => res.json());
    },
    enabled: !!(user as any)?.id,
  });

  const createForm = useForm<TeamFormData>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      description: "",
      homeGround: "",
      teamType: "recreational",
      contactEmail: "",
      contactPhone: "",
      website: "",
      teamColor: "#3B82F6",
      managerId: (user as any)?.id || 0,
    },
  });

  const editForm = useForm<TeamFormData>({
    resolver: zodResolver(teamFormSchema),
  });

  const createTeamMutation = useMutation({
    mutationFn: async (teamData: TeamFormData) => {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create team");
      }
      return response.json();
    },
    onSuccess: async (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/manager", (user as any)?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      // Generate a join link for the newly created team
      try {
        const res = await fetch(`/api/teams/${newTeam.id}/join-link`, { method: "POST", credentials: "include" });
        if (res.ok) {
          const { joinUrl } = await res.json();
          setJoinLinkDialog({ teamName: newTeam.name, joinUrl });
          return;
        }
      } catch (_) {}
      toast({ title: "Success", description: "Team created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TeamFormData> }) => {
      const response = await fetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/manager", (user as any)?.id] });
      setEditingTeam(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/manager", (user as any)?.id] });
      setDeletingTeam(null);
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getJoinLink = async (team: Team) => {
    try {
      const res = await fetch(`/api/teams/${team.id}/join-link`, { method: "POST", credentials: "include" });
      if (res.ok) {
        const { joinUrl } = await res.json();
        setJoinLinkDialog({ teamName: team.name, joinUrl });
      } else {
        toast({ title: "Error", description: "Failed to get join link", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to get join link", variant: "destructive" });
    }
  };

  const handleCreateTeam = (data: TeamFormData) => {
    // Always stamp the current user's id — the form default may have been 0
    // if the user object hadn't loaded yet when the form was initialized.
    createTeamMutation.mutate({ ...data, managerId: (user as any)?.id });
  };

  const handleUpdateTeam = (data: TeamFormData) => {
    if (!editingTeam) return;
    updateTeamMutation.mutate({ id: editingTeam.id, data });
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    editForm.reset({
      name: team.name,
      description: team.description || "",
      homeGround: team.homeGround || "",
      teamType: team.teamType || "recreational",
      contactEmail: team.contactEmail || "",
      contactPhone: team.contactPhone || "",
      website: team.website || "",
      foundedYear: team.foundedYear || undefined,
      teamColor: team.teamColor || "#3B82F6",
      managerId: team.managerId,
    });
  };

  const TeamForm = ({ form, onSubmit, isLoading }: {
    form: any;
    onSubmit: (data: TeamFormData) => void;
    isLoading: boolean;
  }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter team name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teamType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="recreational">Recreational</SelectItem>
                    <SelectItem value="competitive">Competitive</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe your team, playing style, achievements, etc."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Tell potential players about your team's goals and culture
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="homeGround"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Home Ground</FormLabel>
                <FormControl>
                  <Input placeholder="Main playing venue" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="foundedYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Founded Year</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="e.g. 2020"
                    {...field} 
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="team@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://yourteam.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teamColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Color</FormLabel>
                <FormControl>
                  <div className="flex items-center space-x-2">
                    <Input 
                      type="color" 
                      className="w-12 h-10 border rounded cursor-pointer"
                      {...field} 
                    />
                    <Input 
                      placeholder="#3B82F6" 
                      {...field}
                      className="flex-1"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Choose your team's primary color for branding
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingTeam(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : editingTeam ? "Update Team" : "Create Team"}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load teams. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">Create and manage your cricket teams</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Set up a new cricket team and start inviting players
              </DialogDescription>
            </DialogHeader>
            <TeamForm 
              form={createForm} 
              onSubmit={handleCreateTeam} 
              isLoading={createTeamMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first team to start managing players and matches
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team: Team) => (
            <Card key={team.id} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full border" 
                      style={{ backgroundColor: team.teamColor || "#3B82F6" }}
                    />
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(team)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Team
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => getJoinLink(team)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Get Join Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingTeam(team)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {team.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {team.teamType || "recreational"}
                  </Badge>
                  {team.isActive && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Active
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {team.homeGround && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-3 w-3" />
                      <span>{team.homeGround}</span>
                    </div>
                  )}
                  {team.foundedYear && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3" />
                      <span>Founded {team.foundedYear}</span>
                    </div>
                  )}
                  {team.contactEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{team.contactEmail}</span>
                    </div>
                  )}
                  {team.contactPhone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3 w-3" />
                      <span>{team.contactPhone}</span>
                    </div>
                  )}
                  {team.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="h-3 w-3" />
                      <span className="truncate">{team.website}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate("/player-management")}
                  >
                    <Users className="mr-2 h-3 w-3" />
                    Manage Players
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Team Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update your team information and settings
            </DialogDescription>
          </DialogHeader>
          <TeamForm 
            form={editForm} 
            onSubmit={handleUpdateTeam} 
            isLoading={updateTeamMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <AlertDialog open={!!deletingTeam} onOpenChange={() => setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTeam?.name}"? This action cannot be undone. 
              All team data, including players, matches, and statistics will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingTeam) {
                  deleteTeamMutation.mutate(deletingTeam.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteTeamMutation.isPending}
            >
              {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Join Link Dialog */}
      <Dialog open={!!joinLinkDialog} onOpenChange={() => { setJoinLinkDialog(null); setCopied(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-600" />
              Team Join Link
            </DialogTitle>
            <DialogDescription>
              Share this link with players to let them join <strong>{joinLinkDialog?.teamName}</strong>.
              Anyone with this link can sign up and join the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm break-all flex-1 font-mono">{joinLinkDialog?.joinUrl}</span>
            </div>
            <Button
              className="w-full"
              onClick={() => joinLinkDialog && copyToClipboard(joinLinkDialog.joinUrl)}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}