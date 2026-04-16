import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Calendar, MapPin, Trophy, Edit, Trash2, MoreHorizontal, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const matchFormSchema = z.object({
  opponent: z.string().min(1, "Opponent is required"),
  venue: z.string().min(1, "Venue is required"),
  date: z.string().min(1, "Date is required"),
  matchType: z.enum(["T20", "T25", "T30", "ODI", "Test"]),
  matchFee: z.string().optional(),
});

type MatchFormValues = z.infer<typeof matchFormSchema>;

function getTotalOvers(type: string): number {
  switch (type) {
    case "T20": return 20;
    case "T25": return 25;
    case "T30": return 30;
    case "ODI": return 50;
    case "Test": return 90;
    default: return 20;
  }
}

function getStatusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "scheduled": return "default";
    case "live": return "destructive";
    case "completed": return "secondary";
    case "cancelled": return "outline";
    default: return "default";
  }
}

function MatchCard({
  match,
  isPlayer,
  onEdit,
  onDelete,
}: {
  match: any;
  isPlayer: boolean;
  onEdit: (match: any) => void;
  onDelete: (matchId: number) => void;
}) {
  const opponentDisplay = match.awayTeamName || match.opponentName || "Opponent";

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">vs {opponentDisplay}</h3>
            <Badge variant="outline" className="text-xs shrink-0">{match.matchType}</Badge>
            <Badge variant={getStatusBadgeVariant(match.status)} className="text-xs capitalize shrink-0">
              {match.status}
            </Badge>
          </div>
        </div>

        {!isPlayer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(match)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Match</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the match against{" "}
                      <strong>{opponentDisplay}</strong>? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDelete(match.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{new Date(match.date).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{new Date(match.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{match.venue}</span>
        </div>
        {match.matchFee && (
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span>Fee: {match.matchFee}</span>
          </div>
        )}
      </div>

      {match.result && (
        <p className="text-sm font-medium text-foreground border-t pt-2">{match.result}</p>
      )}
    </div>
  );
}

function MatchFormDialog({
  open,
  onOpenChange,
  editingMatch,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMatch: any | null;
  onSubmit: (data: MatchFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchFormSchema),
    defaultValues: editingMatch
      ? {
          opponent: editingMatch.opponentName || editingMatch.awayTeamName || "",
          venue: editingMatch.venue || "",
          date: editingMatch.date
            ? new Date(editingMatch.date).toISOString().slice(0, 16)
            : "",
          matchType: editingMatch.matchType || "T20",
          matchFee: editingMatch.matchFee || "",
        }
      : {
          opponent: "",
          venue: "",
          date: "",
          matchType: "T20",
          matchFee: "",
        },
  });

  // Reset form whenever the dialog opens/closes or the editing target changes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = (data: MatchFormValues) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingMatch ? "Edit Match" : "Schedule Match"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="opponent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opponent</FormLabel>
                  <FormControl>
                    <Input placeholder="Opponent team name" {...field} />
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date &amp; Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="matchType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select match type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="T20">T20</SelectItem>
                      <SelectItem value="T25">T25</SelectItem>
                      <SelectItem value="T30">T30</SelectItem>
                      <SelectItem value="ODI">ODI</SelectItem>
                      <SelectItem value="Test">Test</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="matchFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Fee (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 500.00" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : editingMatch ? "Save Changes" : "Schedule Match"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedule() {
  const { user } = useAuth();
  const { toast } = useToast();

  const teamId = (user as any)?.teamId || 0;
  const isPlayer = (user as any)?.role === "player";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);

  const { data: upcomingMatches, isLoading: loadingUpcoming } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/upcoming`],
    enabled: !!teamId,
  });

  const { data: recentMatches, isLoading: loadingRecent } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/recent`],
    enabled: !!teamId,
  });

  useQuery({
    queryKey: ["/api/teams"],
  });

  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/upcoming`] });
    queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/recent`] });
  };

  const createMutation = useMutation({
    mutationFn: (data: MatchFormValues) =>
      apiRequest("POST", "/api/matches", {
        homeTeamId: teamId,
        opponentName: data.opponent,
        date: new Date(data.date).toISOString(),
        venue: data.venue,
        matchType: data.matchType,
        totalOvers: getTotalOvers(data.matchType),
        matchFee: data.matchFee || null,
        status: "scheduled",
      }),
    onSuccess: () => {
      invalidateMatches();
      setIsDialogOpen(false);
      toast({ title: "Match scheduled", description: "The match has been added to your schedule." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to schedule match.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MatchFormValues }) =>
      apiRequest("PATCH", `/api/matches/${id}`, {
        opponentName: data.opponent,
        date: new Date(data.date).toISOString(),
        venue: data.venue,
        matchType: data.matchType,
        totalOvers: getTotalOvers(data.matchType),
        matchFee: data.matchFee || null,
      }),
    onSuccess: () => {
      invalidateMatches();
      setIsDialogOpen(false);
      setEditingMatch(null);
      toast({ title: "Match updated", description: "The match details have been updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update match.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (matchId: number) => apiRequest("DELETE", `/api/matches/${matchId}`),
    onSuccess: () => {
      invalidateMatches();
      toast({ title: "Match deleted", description: "The match has been removed." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete match.",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (data: MatchFormValues) => {
    if (editingMatch) {
      updateMutation.mutate({ id: editingMatch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (match: any) => {
    setEditingMatch(match);
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) setEditingMatch(null);
    setIsDialogOpen(open);
  };

  const upcoming = (upcomingMatches as any[]) || [];
  const recent = (recentMatches as any[]) || [];
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground">
            {isPlayer ? "View your team's upcoming and recent matches" : "Manage your team's match schedule"}
          </p>
        </div>
        {!isPlayer && (
          <Button
            onClick={() => {
              setEditingMatch(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Match
          </Button>
        )}
      </div>

      {/* Match form dialog (manager only) */}
      {!isPlayer && (
        <MatchFormDialog
          open={isDialogOpen}
          onOpenChange={handleDialogOpenChange}
          editingMatch={editingMatch}
          onSubmit={handleFormSubmit}
          isPending={isMutating}
        />
      )}

      {/* Upcoming Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUpcoming ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading matches...
            </div>
          ) : upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((match: any) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isPlayer={isPlayer}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No upcoming matches</h3>
              <p className="text-muted-foreground text-sm">
                {isPlayer
                  ? "Your team has no upcoming matches scheduled."
                  : "Schedule a new match to get started."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading matches...
            </div>
          ) : recent.length > 0 ? (
            <div className="space-y-3">
              {recent.map((match: any) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isPlayer={isPlayer}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No recent matches</h3>
              <p className="text-muted-foreground text-sm">Completed and past matches will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
