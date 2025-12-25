import { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface AddressSelectorProps {
  selectedAddress: string;
  onAddressChange: (address: string) => void;
}

const addressLabels = [
  { value: 'Home', icon: <Home className="w-4 h-4" /> },
  { value: 'Work', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'Other', icon: <MapPinned className="w-4 h-4" /> },
];

export function AddressSelector({ selectedAddress, onAddressChange }: AddressSelectorProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('Home');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const fetchAddresses = async () => {
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user!.id)
      .order('is_default', { ascending: false });
    
    if (data) {
      setAddresses(data as CustomerAddress[]);
      // If no address selected and we have saved addresses, select default or first
      if (!selectedAddress && data.length > 0) {
        const defaultAddr = data.find(a => a.is_default) || data[0];
        onAddressChange(defaultAddr.address);
      }
    }
  };

  const addAddress = async () => {
    if (!newAddress.trim()) {
      toast.error('Please enter an address');
      return;
    }

    setLoading(true);
    try {
      const isFirst = addresses.length === 0;
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          user_id: user!.id,
          label: newLabel,
          address: newAddress,
          is_default: isFirst,
        })
        .select()
        .single();

      if (error) throw error;

      setAddresses([...addresses, data as CustomerAddress]);
      onAddressChange(newAddress);
      setNewAddress('');
      setShowAddDialog(false);
      toast.success('Address saved!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save address');
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
              <div className="flex gap-2">
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

      {addresses.length > 0 ? (
        <RadioGroup value={selectedAddress} onValueChange={onAddressChange}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
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
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter your address"
            value={selectedAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="pl-10"
          />
        </div>
      )}
    </div>
  );
}
