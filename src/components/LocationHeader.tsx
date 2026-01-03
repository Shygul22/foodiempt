import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface LocationHeaderProps {
  address: string;
  onAddressChange: (address: string) => void;
}

export function LocationHeader({ address, onAddressChange }: LocationHeaderProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(address);

  const handleSave = () => {
    if (inputValue.trim()) {
      onAddressChange(inputValue.trim());
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-1 px-2 h-auto py-1 hover:bg-secondary/80"
        >
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground leading-none">Delivery to</p>
            <p className="text-xs font-semibold text-foreground leading-tight flex items-center gap-0.5">
              {address || 'Set Location'}
              <ChevronDown className="w-3 h-3" />
            </p>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Delivery Location</h4>
          
          <Input
            placeholder="Enter your delivery address"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          <Button onClick={handleSave} className="w-full" size="sm">
            Save Location
          </Button>

          <p className="text-[10px] text-muted-foreground">
            Enter your address to see shops that deliver to your area
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}