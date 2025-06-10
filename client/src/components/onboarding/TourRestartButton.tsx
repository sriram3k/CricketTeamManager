import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import OnboardingTour from "./OnboardingTour";

export default function TourRestartButton() {
  const [isTourOpen, setIsTourOpen] = useState(false);

  const startTour = () => {
    // Clear the completed flag temporarily to show the tour
    localStorage.removeItem('cricmanager-tour-completed');
    setIsTourOpen(true);
  };

  const onTourClose = () => {
    setIsTourOpen(false);
    // Restore the completed flag when tour ends
    localStorage.setItem('cricmanager-tour-completed', 'true');
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={startTour}
            className="fixed bottom-4 right-4 z-30 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg rounded-full h-12 w-12"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Take the tour again</p>
        </TooltipContent>
      </Tooltip>
      <OnboardingTour isOpen={isTourOpen} onClose={onTourClose} />
    </>
  );
}