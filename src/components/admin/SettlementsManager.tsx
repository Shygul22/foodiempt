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
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { Loader2, DollarSign } from 'lucide-react';

interface PartnerSettlementSummary {
    partner_id: string;
    partner_name: string;
    phone: string;
    total_earnings: number;
    total_settled: number;
    pending_balance: number;
}

export const SettlementsManager = () => {
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState<PartnerSettlementSummary[]>([]);
    const [selectedPartner, setSelectedPartner] = useState<PartnerSettlementSummary | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch all partners
            const { data: partners, error: partnersError } = await supabase
                .from('delivery_partners')
                .select('*')
                .order('created_at');

            if (partnersError) throw partnersError;
            if (!partners) throw new Error('No partners found');

            // 1b. Fetch profiles for these partners
            const userIds = partners.map(p => p.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            // 2. Fetch all orders (delivered) to calculate total earnings
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('delivery_partner_id, delivery_fee, created_at')
                .eq('status', 'delivered');

            if (ordersError) throw ordersError;

            // 3. Fetch all settlements
            const { data: settlements, error: settlementsError } = await supabase
                .from('settlements')
                .select('delivery_partner_id, amount');

            if (settlementsError) throw settlementsError;

            // 4. Calculate summaries
            const summaryList = partners.map(partner => {
                const profile = profiles?.find(p => p.id === partner.user_id);
                const partnerOrders = orders?.filter(o => o.delivery_partner_id === partner.id) || [];
                const partnerSettlements = settlements?.filter(s => s.delivery_partner_id === partner.id) || [];

                const rawEarnings = partnerOrders.reduce((sum, o) => sum + (o.delivery_fee || 30), 0);
                const rawSettled = partnerSettlements.reduce((sum, s) => sum + Number(s.amount), 0);

                // Round to 2 decimal places to avoid floating point errors
                const totalEarnings = Number(Math.max(0, rawEarnings).toFixed(2));
                const totalSettled = Number(rawSettled.toFixed(2));
                const pendingBalance = Number((totalEarnings - totalSettled).toFixed(2));

                return {
                    partner_id: partner.id,
                    partner_name: profile?.full_name || 'Unknown',
                    phone: profile?.phone || partner.phone || '-',
                    total_earnings: totalEarnings,
                    total_settled: totalSettled,
                    pending_balance: pendingBalance
                };
            });

            setSummaries(summaryList);

        } catch (error) {
            const err = error as Error;
            console.error('Error fetching settlement data:', err);
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
    }, [fetchData]);

    const handleSettle = async () => {
        if (!selectedPartner || !settleAmount) return;

        try {
            const { error } = await supabase
                .from('settlements')
                .insert({
                    delivery_partner_id: selectedPartner.partner_id,
                    amount: Number(settleAmount),
                    status: 'processed', // Auto-process for now as Admin is doing it manually
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
            setSelectedPartner(null);
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
                    <CardTitle>Partner Settlements</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Partner</TableHead>
                                <TableHead>Total Earnings</TableHead>
                                <TableHead>Total Settled</TableHead>
                                <TableHead>Pending Balance</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaries.map((partner) => (
                                <TableRow key={partner.partner_id}>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{partner.partner_name}</div>
                                            <div className="text-xs text-muted-foreground">{partner.phone}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(partner.total_earnings)}</TableCell>
                                    <TableCell>{formatCurrency(partner.total_settled)}</TableCell>
                                    <TableCell className={partner.pending_balance > 0 ? "text-green-600 font-medium" : ""}>
                                        {formatCurrency(partner.pending_balance)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSelectedPartner(partner);
                                                setSettleAmount(partner.pending_balance.toString());
                                                setIsDialogOpen(true);
                                            }}
                                            disabled={partner.pending_balance < 1}
                                        >
                                            <DollarSign className="w-4 h-4 mr-1" />
                                            Settle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Process Settlement</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Partner</label>
                            <Input value={selectedPartner?.partner_name} disabled />
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
