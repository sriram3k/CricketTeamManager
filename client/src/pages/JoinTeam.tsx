import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Users, CheckCircle } from "lucide-react";

export default function JoinTeam() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [team, setTeam] = useState<{ id: number; name: string; description?: string; teamType?: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Fetch team info from the token
  useEffect(() => {
    if (!token) return;
    fetch(`/api/join-team/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Invalid join link");
        } else {
          setTeam(await res.json());
        }
      })
      .catch(() => setError("Failed to load team info"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      // Redirect to signup with the join token
      setLocation(`/signup?joinToken=${token}&teamName=${encodeURIComponent(team?.name || "")}`);
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/join-team/${token}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setJoined(true);
        toast({ title: "Joined!", description: `You've joined ${team?.name}.` });
        setTimeout(() => setLocation("/"), 2000);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to join team", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Invalid Join Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/")}>Go to CrickIQ</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          {joined ? (
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
          ) : (
            <div className="p-3 bg-green-600 rounded-full w-fit mx-auto mb-2">
              <Users className="h-8 w-8 text-white" />
            </div>
          )}
          <CardTitle>{joined ? "Joined!" : `Join ${team?.name}`}</CardTitle>
          <CardDescription>
            {joined
              ? `You're now a member of ${team?.name}. Redirecting…`
              : team?.description || `You've been invited to join ${team?.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!joined && (
            <>
              {team?.teamType && (
                <p className="text-sm text-center text-muted-foreground capitalize">
                  {team.teamType} team
                </p>
              )}
              <Button className="w-full" onClick={handleJoin} disabled={joining}>
                {joining ? "Joining…" : isAuthenticated ? `Join ${team?.name}` : "Sign up to join"}
              </Button>
              {!isAuthenticated && (
                <Button variant="outline" className="w-full" onClick={() => setLocation(`/login?joinToken=${token}`)}>
                  Already have an account? Log in
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
