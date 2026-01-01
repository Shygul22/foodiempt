import { useState } from 'react';
import { MapPin, ChevronDown, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LocationHeaderProps {
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function LocationHeader({ loading, error, onRefresh }: LocationHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-1 px-2 h-auto py-1 hover:bg-secondary/80"
        >
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-primary" />
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground leading-none">Delivery to</p>
            <p className="text-xs font-semibold text-foreground leading-tight flex items-center gap-0.5">
              {loading ? 'Locating...' : error ? 'Set Location' : 'Current Location'}
              <ChevronDown className="w-3 h-3" />
            </p>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Your Location</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-7 text-xs gap-1"
            >
              <Navigation className="w-3 h-3" />
              Detect
            </Button>
          </div>
          
          {error ? (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Getting your location...
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2 p-2 bg-accent/10 rounded-lg">
                <MapPin className="w-4 h-4 text-accent" />
                <span>Using GPS location for nearby shops</span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Enable location to see shops near you with accurate delivery times
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
