import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CustomerAddress } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Home,
  Briefcase,
  MapPinned,
  Check,
  Trash2,
  LocateFixed,
  Loader2,
  ChevronsUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DeliveryPincode } from '@/types/database';

interface AddressSelectorProps {
  selectedAddress: string;
  onAddressChange: (address: string) => void;
  onPincodeChange?: (pincode: string) => void;
  onLocalityChange?: (locality: string) => void;
}

const addressLabels = [
  { value: 'Home', icon: <Home className="w-4 h-4" /> },
  { value: 'Work', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'Other', icon: <MapPinned className="w-4 h-4" /> },
];

export function AddressSelector({ selectedAddress, onAddressChange, onPincodeChange, onLocalityChange }: AddressSelectorProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newPincodeDescription, setNewPincodeDescription] = useState('');
  const [newLabel, setNewLabel] = useState('Home');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // Pincode selection state
  const [openPincode, setOpenPincode] = useState(false);
  const [availablePincodes, setAvailablePincodes] = useState<DeliveryPincode[]>([]);

  const fetchPincodes = useCallback(async () => {
    const { data } = await supabase
      .from('delivery_pincodes')
      .select('*')
      .eq('is_active', true)
      .order('pincode');

    if (data) {
      setAvailablePincodes(data);
    }
  }, []);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (data) {
      setAddresses(data as CustomerAddress[]);
      if (selectedAddress) {
        const current = data.find(a => a.address === selectedAddress);
        if (current && current.pincode && onPincodeChange) {
          onPincodeChange(current.pincode);
        }
        if (current && current.locality && onLocalityChange) {
          onLocalityChange(current.locality);
        } else if (selectedAddress && onPincodeChange) {
          // Try to extract pincode from the address string (looking for 6 digits)
          const pincodeMatch = selectedAddress.match(/\b\d{6}\b/);
          if (pincodeMatch) {
            onPincodeChange(pincodeMatch[0]);
          }
        }
      }

      // If no address selected and we have saved addresses, select default or first
      if (!selectedAddress && data.length > 0) {
        const defaultAddr = data.find(a => a.is_default) || data[0];
        onAddressChange(defaultAddr.address);
        if (onPincodeChange && defaultAddr.pincode) {
          onPincodeChange(defaultAddr.pincode);
        }
      }
    }
  }, [user, selectedAddress, onAddressChange, onPincodeChange, onLocalityChange]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
      fetchPincodes();
    }
  }, [user, fetchAddresses, fetchPincodes]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // Use OpenStreetMap Nominatim for reverse geocoding
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          if (data && data.address) {
            const addr = data.display_name;
            const pincode = data.address.postcode || '';

            setNewAddress(addr);
            if (pincode) {
              setNewPincode(pincode.replace(/\D/g, '')); // Ensure only digits
            }
            toast.success('Location detected!');
          } else {
            toast.error('Could not fetch address details');
          }
        } catch (error) {
          toast.error('Failed to fetch address details');
          console.error(error);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out');
            break;
          default:
            toast.error('An unknown error occurred');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const addAddress = async () => {
    if (!newAddress.trim()) {
      toast.error('Please enter an address');
      return;
    }

    if (!newPincode.trim() || newPincode.length < 6) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }

    setLoading(true);
    try {
      // Validate pincode 
      const { data: pincodeData, error: pincodeError } = await supabase
        .from('delivery_pincodes')
        .select('id')
        .eq('pincode', newPincode)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (pincodeError) throw pincodeError;

      if (!pincodeData) {
        toast.error('Sorry, we do not deliver to this pincode yet');
        setLoading(false);
        return;
      }
      const isFirst = addresses.length === 0;
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          user_id: user!.id,
          label: newLabel,
          address: newAddress,
          pincode: newPincode,
          locality: newPincodeDescription,
          is_default: isFirst,
        })
        .select()
        .single();

      if (error) throw error;

      setAddresses([...addresses, data as CustomerAddress]);
      onAddressChange(newAddress);
      if (onPincodeChange) onPincodeChange(newPincode);
      setNewAddress('');
      setNewPincode('');
      setNewPincodeDescription('');
      setShowAddDialog(false);
      toast.success('Address saved!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save address';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', id);

      setAddresses(addresses.filter(a => a.id !== id));
      toast.success('Address deleted');
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      // Remove default from all
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('user_id', user!.id);

      // Set new default
      await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', id);

      fetchAddresses();
      toast.success('Default address updated');
    } catch (error) {
      toast.error('Failed to update default');
    }
  };

  const handleAddressSelect = (address: string) => {
    onAddressChange(address);
    const selected = addresses.find(a => a.address === address);
    if (selected && selected.pincode && onPincodeChange) {
      onPincodeChange(selected.pincode);
    }
    if (selected && selected.locality && onLocalityChange) {
      onLocalityChange(selected.locality);
    }
  };

  const getLabelIcon = (label: string) => {
    const found = addressLabels.find(l => l.value === label);
    return found?.icon || <MapPinned className="w-4 h-4" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Delivery Address</Label>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-primary border-primary/20 hover:bg-primary/5"
                onClick={detectLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LocateFixed className="w-4 h-4" />
                )}
                {locating ? 'Detecting...' : 'Use Current Location'}
              </Button>

              <div className="flex gap-2 flex-wrap">
                {addressLabels.map((label) => (
                  <Button
                    key={label.value}
                    variant={newLabel === label.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewLabel(label.value)}
                    className="gap-2"
                  >
                    {label.icon}
                    {label.value}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-address">Full Address</Label>
                <Input
                  id="new-address"
                  placeholder="Enter your complete address..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-pincode">Pincode</Label>
                <Popover open={openPincode} onOpenChange={setOpenPincode}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPincode}
                      className="w-full justify-between"
                    >
                      {newPincode
                        ? `${newPincode} - ${newPincodeDescription || availablePincodes.find((p) => p.pincode === newPincode)?.description || ''}`
                        : "Select pincode..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search pincode or area..." />
                      <CommandList>
                        <CommandEmpty>No delivery area found.</CommandEmpty>
                        <CommandGroup heading="Available Delivery Areas">
                          {availablePincodes.map((pincode) => (
                            <CommandItem
                              key={pincode.id}
                              value={`${pincode.pincode} ${pincode.description || ''}`}
                              onSelect={() => {
                                setNewPincode(pincode.pincode);
                                setNewPincodeDescription(pincode.description || '');
                                setOpenPincode(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newPincode === pincode.pincode ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{pincode.pincode}</span>
                                {pincode.description && (
                                  <span className="text-xs text-muted-foreground">{pincode.description}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={addAddress}
                disabled={loading || !newAddress.trim()}
                className="w-full"
              >
                {loading ? 'Saving...' : 'Save Address'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length > 0 || selectedAddress ? (
        <RadioGroup value={selectedAddress} onValueChange={handleAddressSelect}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {/* Show currently selected/detected address if not in saved list */}
            {selectedAddress && !addresses.find(a => a.address === selectedAddress) && (
              <div className="flex items-center space-x-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
                <RadioGroupItem value={selectedAddress} id="current-location" />
                <Label htmlFor="current-location" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">Current Location</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {selectedAddress}
                  </p>
                </Label>
              </div>
            )}

            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <RadioGroupItem value={addr.address} id={addr.id} />
                <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    {getLabelIcon(addr.label)}
                    <span className="font-medium">{addr.label}</span>
                    {addr.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {addr.address}
                    <br />
                    <span className="text-xs text-muted-foreground/80">
                      Pin: {addr.pincode || 'N/A'}
                    </span>
                  </p>
                </Label>
                <div className="flex gap-1">
                  {!addr.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDefaultAddress(addr.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteAddress(addr.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      ) : (
        <div className="text-center py-8 bg-muted/20 rounded-lg border-2 border-dashed">
          <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No saved addresses found</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            Add New Address
          </Button>
        </div>
      )}
    </div>
  );
}