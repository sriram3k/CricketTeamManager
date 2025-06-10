import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, Check, Target, Users, Calendar, CreditCard, FileText, BarChart3 } from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  icon: any;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CricManager!',
    content: 'Your complete cricket team management platform. Let\'s take a quick tour of the key features.',
    target: '',
    icon: Target,
    position: 'bottom'
  },
  {
    id: 'dashboard',
    title: 'Team Command Centre',
    content: 'Your main dashboard shows team stats, recent matches, upcoming fixtures, and quick actions.',
    target: '[data-tour="dashboard"]',
    icon: BarChart3,
    position: 'bottom'
  },
  {
    id: 'schedule-match',
    title: 'Schedule Matches',
    content: 'Click here to schedule new matches against other teams. Set date, venue, and match details.',
    target: '[data-tour="schedule-match"]',
    icon: Calendar,
    position: 'bottom'
  },
  {
    id: 'live-scoring',
    title: 'Live Match Scoring',
    content: 'Score matches in real-time with ball-by-ball data entry and live updates.',
    target: '[data-tour="live-scoring"]',
    icon: Target,
    position: 'right'
  },
  {
    id: 'players',
    title: 'Squad Management',
    content: 'Manage your team roster, add new players, and track player information.',
    target: '[data-tour="players"]',
    icon: Users,
    position: 'right'
  },
  {
    id: 'availability',
    title: 'Player Availability',
    content: 'Request player availability for matches and track responses from your team.',
    target: '[data-tour="availability"]',
    icon: Calendar,
    position: 'right'
  },
  {
    id: 'payments',
    title: 'Match Fees',
    content: 'Track player payments for matches, manage pending fees, and payment history.',
    target: '[data-tour="payments"]',
    icon: CreditCard,
    position: 'right'
  },
  {
    id: 'invoices',
    title: 'Club Invoices',
    content: 'Generate and manage invoices for corporate matches and team expenses.',
    target: '[data-tour="invoices"]',
    icon: FileText,
    position: 'right'
  },
  {
    id: 'analytics',
    title: 'Performance Analytics',
    content: 'Analyze team performance, player statistics, and match insights to improve your game.',
    target: '[data-tour="analytics"]',
    icon: BarChart3,
    position: 'right'
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tourPosition, setTourPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && currentStep > 0) {
      const step = tourSteps[currentStep];
      const targetElement = document.querySelector(step.target);
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        let top = rect.top + scrollTop;
        let left = rect.left;
        
        switch (step.position) {
          case 'bottom':
            top = rect.bottom + scrollTop + 10;
            left = rect.left + (rect.width / 2) - 200;
            break;
          case 'top':
            top = rect.top + scrollTop - 200;
            left = rect.left + (rect.width / 2) - 200;
            break;
          case 'right':
            top = rect.top + scrollTop + (rect.height / 2) - 100;
            left = rect.right + 10;
            break;
          case 'left':
            top = rect.top + scrollTop + (rect.height / 2) - 100;
            left = rect.left - 410;
            break;
        }
        
        setTourPosition({ top: Math.max(10, top), left: Math.max(10, left) });
        
        // Highlight the target element
        targetElement.classList.add('tour-highlight');
        
        // Scroll to element if needed
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    // Cleanup previous highlights
    return () => {
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    };
  }, [currentStep, isOpen]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const finishTour = () => {
    localStorage.setItem('cricmanager-tour-completed', 'true');
    onClose();
  };

  const skipTour = () => {
    localStorage.setItem('cricmanager-tour-completed', 'true');
    onClose();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" />
      
      {/* Tour Card */}
      <Card 
        className="fixed z-50 w-96 shadow-2xl border-2 border-primary"
        style={currentStep === 0 ? { 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)' 
        } : { 
          top: tourPosition.top, 
          left: tourPosition.left 
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={skipTour}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.content}
          </p>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStep 
                      ? 'bg-primary' 
                      : index < currentStep 
                        ? 'bg-primary/60' 
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <Badge variant="outline" className="text-xs">
              {currentStep + 1} of {tourSteps.length}
            </Badge>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex justify-between">
            <div className="flex space-x-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-muted-foreground"
              >
                Skip Tour
              </Button>
            </div>
            
            <Button
              size="sm"
              onClick={nextStep}
              className="bg-primary hover:bg-primary/90"
            >
              {currentStep === tourSteps.length - 1 ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}