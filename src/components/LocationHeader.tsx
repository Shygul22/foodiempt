import { useState } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { MapPin, ChevronDown, Map as MapIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LocationHeaderProps {
  address: string;
  onAddressChange: (address: string) => void;
}

export function LocationHeader({ address, onAddressChange }: LocationHeaderProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(address);
  const haptics = useHaptics();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]); // To store suggestions if needed later, or just debug

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || query.length < 6) {
      toast.error('Please enter a valid 6-digit Pincode');
      return;
    }

    setIsSearchLoading(true);
    setSearchResults([]);
    try {
      const fetchUrl = `https://api.postalpincode.in/pincode/${query}`;

      const response = await fetch(fetchUrl);
      const data = await response.json();

      // API returns an array: [{ Message, Status, PostOffice: [...] }]
      if (data && data.length > 0 && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        setSearchResults(data[0].PostOffice);
      } else {
        toast.error('No location found. Please enter a valid Pincode.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search location');
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSelectLocation = (office: any) => {
    const parts = [
      office.Name,
      office.District,
      office.State,
      office.Pincode
    ];

    const formattedAddress = parts.filter(Boolean).join(', ');

    setInputValue(formattedAddress);
    onAddressChange(formattedAddress);
    setSearchResults([]); // Clear results after selection
    setSearchQuery(''); // Optionally clear query
    setOpen(false); // Close popover on selection

    toast.success(`Location selected: ${formattedAddress}`);
  };

  const handleSave = () => {
    if (inputValue.trim()) {
      onAddressChange(inputValue.trim());
      setOpen(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1 px-2 h-auto py-1 hover:bg-secondary/80 max-w-[200px] md:max-w-none"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left hidden xs:block">
              <p className="text-[10px] text-muted-foreground leading-none">Delivery to</p>
              <p className="text-xs font-bold text-foreground leading-tight flex items-center gap-0.5 max-w-[120px] md:max-w-[200px] truncate">
                {address || 'Set Location'}
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </p>
            </div>
            {/* Mobile simplified view */}
            <div className="text-left xs:hidden">
              <p className="text-xs font-bold text-foreground leading-tight flex items-center gap-0.5 truncate max-w-[100px]">
                {address ? address.split(',')[0] : 'Location'}
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </p>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] md:w-80 p-0 overflow-hidden" align="start">
          <div className="p-4 bg-muted/30">
            <h4 className="font-semibold text-sm mb-3">Delivery Location</h4>

            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Enter your delivery address"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 bg-background"
              />
            </div>

            <div className="mt-3 pt-3 border-t border-dashed">
              <p className="text-xs text-muted-foreground mb-2">Or search by Pincode</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Pincode"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setSearchQuery(val);
                  }}
                  className="flex-1 bg-background h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 px-3"
                  onClick={handleSearch}
                  disabled={isSearchLoading || searchQuery.length < 6}
                >
                  {isSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>

              {/* Data list for search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 text-left max-h-[200px] overflow-y-auto border rounded-md divide-y shadow-sm">
                  {searchResults.map((office, idx) => (
                    <button
                      key={`${office.Name}-${idx}`}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex flex-col gap-0.5"
                      onClick={() => handleSelectLocation(office)}
                    >
                      <span className="font-medium text-foreground">{office.Name}</span>
                      <span className="text-muted-foreground">{office.District}, {office.State} - {office.Pincode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {address && (
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background shadow-sm">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Current Location</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{address}</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 pt-2">
            <Button onClick={handleSave} className="w-full" size="sm">
              Confirm Location
            </Button>
          </div>
        </PopoverContent>
      </Popover>

    </>
  );
}