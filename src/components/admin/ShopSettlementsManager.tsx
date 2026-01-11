import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { Loader2, DollarSign, Store } from 'lucide-react';

interface ShopSettlementSummary {
    restaurant_id: string;
    restaurant_name: string;
    phone: string;
    total_earnings: number; // Net earnings
    total_settled: number;
    pending_balance: number;
    // Breakdown
    gross_total: number;
    total_delivery_fees: number;
    total_platform_fees: number;
    total_commissions: number;
}

export const ShopSettlementsManager = () => {
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState<ShopSettlementSummary[]>([]);
    const [selectedShop, setSelectedShop] = useState<ShopSettlementSummary | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch all restaurants
            const { data: restaurants, error: restaurantsError } = await supabase
                .from('restaurants')
                .select('id, name, owner_id, phone, commission_rate')
                .order('created_at');

            if (restaurantsError) throw restaurantsError;
            if (!restaurants) throw new Error('No restaurants found');

            // 2. Fetch all delivered orders
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('restaurant_id, total_amount, delivery_fee')
                .eq('status', 'delivered');

            if (ordersError) throw ordersError;

            // 3. Fetch all settlements for restaurants
            const { data: settlements, error: settlementsError } = await supabase
                .from('settlements')
                .select('restaurant_id, amount')
                .not('restaurant_id', 'is', null);

            if (settlementsError) throw settlementsError;

            // 4. Calculate summaries
            const summaryList = restaurants.map(restaurant => {
                const shopOrders = orders?.filter(o => o.restaurant_id === restaurant.id) || [];
                const shopSettlements = settlements?.filter(s => s.restaurant_id === restaurant.id) || [];

                // Logic: 
                // Item Total = Order Total - Delivery Fee
                // Platform Fee = Item Total * (Commission Rate / 100)
                // Restaurant Earnings = Item Total - Platform Fee

                const commissionRate = Number(restaurant.commission_rate) || 15; // Default 15%
                const FIXED_PLATFORM_FEE = 8; // Matches App hardcoded fee
                const DEFAULT_DELIVERY_FEE = 25; // Matches App default

                const breakdown = shopOrders.reduce((acc, o) => {
                    const orderTotal = Number(o.total_amount) || 0;
                    const dFee = Number(o.delivery_fee) || DEFAULT_DELIVERY_FEE;

                    // Logic from RestaurantDashboard.tsx:
                    // subtotal = Total - Delivery - FixedPlatformFee
                    // commission = subtotal * rate
                    // earnings = subtotal - commission

                    const subtotal = orderTotal - dFee - FIXED_PLATFORM_FEE;
                    const commission = (subtotal * commissionRate) / 100;
                    const earning = Math.max(0, subtotal - commission);

                    return {
                        gross: acc.gross + orderTotal,
                        delivery: acc.delivery + dFee,
                        platform: acc.platform + FIXED_PLATFORM_FEE,
                        commission: acc.commission + commission,
                        net: acc.net + earning
                    };
                }, { gross: 0, delivery: 0, platform: 0, commission: 0, net: 0 });

                const rawSettled = shopSettlements.reduce((sum, s) => sum + Number(s.amount), 0);

                return {
                    restaurant_id: restaurant.id,
                    restaurant_name: restaurant.name,
                    phone: restaurant.phone || '-',
                    total_earnings: Number(breakdown.net.toFixed(2)),
                    total_settled: Number(rawSettled.toFixed(2)),
                    pending_balance: Number((breakdown.net - rawSettled).toFixed(2)),

                    gross_total: breakdown.gross,
                    total_delivery_fees: breakdown.delivery,
                    total_platform_fees: breakdown.platform,
                    total_commissions: breakdown.commission
                };
            });

            setSummaries(summaryList);

        } catch (error) {
            const err = error as Error;
            console.error('Error fetching shop settlement data:', err);
            toast({
                title: "Error loading data",
                description: err.message || "Failed to load settlement data",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('shop-settlements-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                },
                (payload) => {
                    // Only refresh if order status changed to/from 'delivered' or new delivered order
                    // But for simplicity/robustness, we'll refresh on relevant changes
                    if (payload.new && 'status' in (payload.new as any)) {
                        fetchData();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'settlements'
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const handleSettle = async () => {
        if (!selectedShop || !settleAmount) return;

        try {
            const { error } = await supabase
                .from('settlements')
                .insert({
                    restaurant_id: selectedShop.restaurant_id,
                    delivery_partner_id: null, // Explicitly null
                    amount: Number(settleAmount),
                    status: 'processed',
                    reference_no: referenceNo,
                    processed_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({
                title: "Success",
                description: "Settlement recorded successfully",
            });

            setIsDialogOpen(false);
            setSettleAmount('');
            setReferenceNo('');
            setSelectedShop(null);
            fetchData(); // Refresh data

        } catch (error) {
            console.error('Settlement error:', error);
            toast({
                title: "Error",
                description: "Failed to process settlement",
                variant: "destructive"
            });
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Store className="h-5 w-5" />
                        Shop Settlements
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Shop</TableHead>
                                <TableHead>Total Earnings</TableHead>
                                <TableHead>Total Settled</TableHead>
                                <TableHead>Pending Balance</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaries.map((shop) => (
                                <TableRow key={shop.restaurant_id}>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{shop.restaurant_name}</div>
                                            <div className="text-xs text-muted-foreground">{shop.phone}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="group relative">
                                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50">
                                                {formatCurrency(shop.total_earnings)}
                                            </span>
                                            {/* Hover Card */}
                                            <div className="absolute left-0 top-full z-50 hidden min-w-[240px] rounded-lg border bg-popover p-4 shadow-md group-hover:block">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Earnings Breakdown</h4>
                                                    <div className="flex justify-between text-sm">
                                                        <span>Gross Total:</span>
                                                        <span className="font-mono">{formatCurrency(shop.gross_total)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-red-500">
                                                        <span>Delivery Fees:</span>
                                                        <span className="font-mono">-{formatCurrency(shop.total_delivery_fees)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-red-500">
                                                        <span>Platform Fees:</span>
                                                        <span className="font-mono">-{formatCurrency(shop.total_platform_fees)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-red-500">
                                                        <span>Commissions:</span>
                                                        <span className="font-mono">-{formatCurrency(shop.total_commissions)}</span>
                                                    </div>
                                                    <div className="my-2 border-t pt-2 flex justify-between font-bold text-sm">
                                                        <span>Net Earnings:</span>
                                                        <span className="font-mono">{formatCurrency(shop.total_earnings)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(shop.total_settled)}</TableCell>
                                    <TableCell className={shop.pending_balance > 0 ? "text-green-600 font-medium" : ""}>
                                        {formatCurrency(shop.pending_balance)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSelectedShop(shop);
                                                setSettleAmount(shop.pending_balance.toString());
                                                setIsDialogOpen(true);
                                            }}
                                            disabled={shop.pending_balance < 1}
                                        >
                                            <DollarSign className="w-4 h-4 mr-1" />
                                            Settle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {summaries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No shops found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Process Shop Settlement</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Shop</label>
                            <Input value={selectedShop?.restaurant_name} disabled />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Amount (₹)</label>
                            <Input
                                type="number"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reference No. (Optional)</label>
                            <Input
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                                placeholder="UPI Ref / Bank Txn ID"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSettle}>Confirm Settlement</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
