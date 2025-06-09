import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TopBar() {
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-card shadow border-b border-border">
      <div className="flex-1 px-4 flex justify-between items-center">
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full max-w-lg">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                className="block w-full pl-10 pr-3 py-2 border-input"
                placeholder="Search matches, players..."
                type="search"
              />
            </div>
          </div>
        </div>
        <div className="ml-4 flex items-center md:ml-6">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive transform translate-x-1/2 -translate-y-1/2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
