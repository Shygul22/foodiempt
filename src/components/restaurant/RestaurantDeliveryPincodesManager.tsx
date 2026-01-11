
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RestaurantDeliveryPincode } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Trash2, MapPin, Plus, Loader2, ChevronsUpDown, Check } from 'lucide-react';
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

interface Props {
    restaurantId: string;
}

export function RestaurantDeliveryPincodesManager({ restaurantId }: Props) {
    const [pincodes, setPincodes] = useState<RestaurantDeliveryPincode[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPincode, setNewPincode] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [availableDescriptions, setAvailableDescriptions] = useState<string[]>([]);
    const [openDescription, setOpenDescription] = useState(false);

    useEffect(() => {
        const fetchPincodeDetails = async () => {
            if (newPincode.length === 6) {
                setFetchingDetails(true);
                try {
                    const response = await fetch(`https://api.postalpincode.in/pincode/${newPincode}`);
                    const data = await response.json();

                    if (data && data[0] && data[0].Status === 'Success') {
                        const postOffices = data[0].PostOffice;
                        if (postOffices && postOffices.length > 0) {
                            const areas = postOffices.map((po: any) => `${po.Name}, ${po.District}`);
                            setAvailableDescriptions(areas);
                            setNewDescription(areas[0]);
                            toast.success(`Found ${areas.length} related areas from postal data`);
                        }
                    } else {
                        toast.error('Invalid Pincode or details not found');
                        setNewDescription('');
                        setAvailableDescriptions([]);
                    }
                } catch (error) {
                    console.error('Error fetching pincode details:', error);
                } finally {
                    setFetchingDetails(false);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            if (newPincode.length === 6) {
                fetchPincodeDetails();
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [newPincode]);

    const fetchPincodes = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('restaurant_delivery_pincodes')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPincodes(data || []);
        } catch (error) {
            toast.error('Failed to load pincodes');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchPincodes();
    }, [fetchPincodes]);

    const addPincode = async () => {
        if (!newPincode.trim() || newPincode.length < 6) {
            toast.error('Please enter a valid 6-digit pincode');
            return;
        }

        if (!newDescription.trim()) {
            toast.error('Description is required');
            return;
        }

        setAdding(true);
        try {
            const { data, error } = await supabase
                .from('restaurant_delivery_pincodes')
                .insert({
                    restaurant_id: restaurantId,
                    pincode: newPincode,
                    description: newDescription || null,
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast.error('This pincode is already added');
                } else {
                    toast.error('Failed to add pincode');
                    throw error;
                }
            } else {
                setPincodes([data, ...pincodes]);
                setNewPincode('');
                setNewDescription('');
                toast.success('Delivery area added successfully');
            }
        } catch (error) {
            // Already handled error toast above
        } finally {
            setAdding(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('restaurant_delivery_pincodes')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setPincodes(pincodes.map(p =>
                p.id === id ? { ...p, is_active: !currentStatus } : p
            ));
            toast.success(`Pincode ${!currentStatus ? 'activated' : 'deactivated'}`);
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const deletePincode = async (id: string) => {
        if (!confirm('Are you sure you want to delete this delivery area?')) return;

        try {
            const { error } = await supabase
                .from('restaurant_delivery_pincodes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPincodes(pincodes.filter(p => p.id !== id));
            toast.success('Delivery area deleted');
        } catch (error) {
            toast.error('Failed to delete delivery area');
        }
    };

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-4 h-4 text-primary" />
                    Delivery Areas ({pincodes.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Add New Pincode */}
                    <div className="flex flex-col md:flex-row gap-3 items-end bg-secondary/20 p-4 rounded-xl border border-border/50">
                        <div className="space-y-2 w-full md:flex-1">
                            <label className="text-xs font-medium text-muted-foreground">Pincode</label>
                            <Input
                                placeholder="Ex: 500001"
                                value={newPincode}
                                onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                            />
                        </div>
                        <div className="space-y-2 w-full md:flex-[2]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                Description <span className="text-destructive">*</span>
                                {fetchingDetails && <Loader2 className="w-3 h-3 animate-spin" />}
                            </label>

                            <Popover
                                open={openDescription}
                                onOpenChange={(open) => {
                                    setOpenDescription(open);
                                    if (open) setSearch('');
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openDescription}
                                        className="w-full justify-between font-normal text-left px-3"
                                    >
                                        <span className="truncate">
                                            {newDescription || "Select or type description..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search or type custom..."
                                            value={search}
                                            onValueChange={setSearch}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-start text-xs h-8"
                                                    onClick={() => {
                                                        setNewDescription(search);
                                                        setOpenDescription(false);
                                                    }}
                                                >
                                                    Use "{search}"
                                                </Button>
                                            </CommandEmpty>
                                            <CommandGroup heading="Available Areas">
                                                {availableDescriptions.map((desc) => (
                                                    <CommandItem
                                                        key={desc}
                                                        value={desc}
                                                        onSelect={(currentValue) => {
                                                            setNewDescription(currentValue);
                                                            setOpenDescription(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                newDescription === desc ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {desc}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={addPincode} disabled={adding || !newPincode || !newDescription}>
                            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                            Add
                        </Button>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-muted-foreground">Loading areas...</div>
                        ) : pincodes.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No delivery areas defined yet.</div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-3">
                                {pincodes.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-base font-bold text-primary">
                                                    {item.pincode}
                                                </span>
                                                <Switch
                                                    checked={item.is_active}
                                                    onCheckedChange={() => toggleStatus(item.id, item.is_active)}
                                                    className="scale-75"
                                                />
                                            </div>
                                            {item.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={item.description}>
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                            onClick={() => deletePincode(item.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
