
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { formatCurrency } from '@/utils/format';
import { Loader2, IndianRupee, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export const FinancialAnalytics = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        netEarnings: 0,
        platformFees: 0,
        commissions: 0,
        pendingPayouts: 0,
        processedPayouts: 0,
    });

    const fetchFinancials = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch Restaurants (for commission rates)
            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id, commission_rate');

            const shopMap = new Map(restaurants?.map(r => [r.id, r.commission_rate]) || []);

            // 2. Fetch Delivered Orders
            const { data: orders } = await supabase
                .from('orders')
                .select('id, total_amount, delivery_fee, restaurant_id, delivery_partner_id')
                .eq('status', 'delivered');

            // 3. Fetch Settlements
            const { data: settlements } = await supabase
                .from('settlements')
                .select('amount, status');

            if (!orders) return;

            const FIXED_PLATFORM_FEE = 8;
            const DEFAULT_DELIVERY_FEE = 25;

            let totalRev = 0;
            let totalPlatFees = 0;
            let totalCommissions = 0;
            let totalShopPayable = 0;
            let totalPartnerPayable = 0;

            orders.forEach(order => {
                const total = Number(order.total_amount) || 0;
                const dFee = Number(order.delivery_fee) || DEFAULT_DELIVERY_FEE;
                const rate = Number(shopMap.get(order.restaurant_id) || 15);

                const subtotal = total - dFee - FIXED_PLATFORM_FEE;
                const commission = (subtotal * rate) / 100;
                const shopEarning = Math.max(0, subtotal - commission);

                // Aggregates
                totalRev += total;
                totalPlatFees += FIXED_PLATFORM_FEE;
                totalCommissions += commission;

                totalShopPayable += shopEarning;
                // Partner earning is delivery fee - simplified
                if (order.delivery_partner_id) {
                    totalPartnerPayable += dFee; // Assuming all delivery fee goes to partner
                }
            });

            // Calculate Settlements
            let processed = 0;
            let pending = 0; // This usually tracks *requests*, but here we calculate *liabilities*

            // Actually, "Pending Payouts" is simpler: Total Payable - Total Settled
            const totalLiabilities = totalShopPayable + totalPartnerPayable;
            const totalSettled = settlements?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

            setStats({
                totalRevenue: totalRev,
                netEarnings: totalPlatFees + totalCommissions,
                platformFees: totalPlatFees,
                commissions: totalCommissions,
                pendingPayouts: Math.max(0, totalLiabilities - totalSettled),
                processedPayouts: totalSettled
            });

        } catch (error) {
            console.error('Error fetching financials:', error);
            toast.error("Failed to load financial data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFinancials();
    }, [fetchFinancials]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-700">Net Earnings</CardTitle>
                        <Wallet className="h-4 w-4 text-green-700" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{formatCurrency(stats.netEarnings)}</div>
                        <p className="text-xs text-green-600/80">Platform Fee + Commissions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{formatCurrency(stats.pendingPayouts)}</div>
                        <p className="text-xs text-muted-foreground">Liabilities to Shops/Partners</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Processed Payouts</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{formatCurrency(stats.processedPayouts)}</div>
                        <p className="text-xs text-muted-foreground">Total Settled Amount</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Total Transaction Volume</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Income Breakdown</CardTitle>
                        <CardDescription>Where your money comes from</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Platform Fees</TableCell>
                                    <TableCell className="text-right text-green-600">+{formatCurrency(stats.platformFees)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Commissions</TableCell>
                                    <TableCell className="text-right text-green-600">+{formatCurrency(stats.commissions)}</TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell>Total Net Inflow</TableCell>
                                    <TableCell className="text-right">{formatCurrency(stats.netEarnings)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Balance Sheet</CardTitle>
                        <CardDescription>Current Financial Position</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Total Liabilities (Payable)</TableCell>
                                    <TableCell className="text-right">{formatCurrency(stats.pendingPayouts + stats.processedPayouts)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="text-muted-foreground pl-6">- Paid (Settled)</TableCell>
                                    <TableCell className="text-right text-red-500">-{formatCurrency(stats.processedPayouts)}</TableCell>
                                </TableRow>
                                <TableRow className="font-medium">
                                    <TableCell>Current Pending Payouts</TableCell>
                                    <TableCell className="text-right text-orange-500">{formatCurrency(stats.pendingPayouts)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
