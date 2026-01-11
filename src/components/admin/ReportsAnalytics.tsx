
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useCallback } from 'react';
import { Calendar as CalendarIcon, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/utils/format';

type DateRangeType = 'today' | 'week' | 'month' | 'custom';

export const ReportsAnalytics = () => {
    const [loading, setLoading] = useState(false);
    const [dateRangeType, setDateRangeType] = useState<DateRangeType>('today');
    const [date, setDate] = useState<Date | undefined>(new Date());

    // Report Data
    const [reportData, setReportData] = useState<{
        orders: any[];
        summary: {
            totalRevenue: number;
            netEarnings: number;
            platformFees: number;
            commissions: number;
            totalOrders: number;
            deliveredOrders: number;
        };
        settlements: {
            totalSettled: number;
            totalPending: number; // Estimated liability
            processedCount: number;
        };
    } | null>(null);

    useEffect(() => {
        fetchReportData();
    }, [dateRangeType, date]);

    const getDateRange = useCallback(() => {
        const now = new Date();
        let start = startOfDay(now);
        let end = endOfDay(now);

        if (dateRangeType === 'today') {
            // defaults
        } else if (dateRangeType === 'week') {
            start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
            end = endOfWeek(now, { weekStartsOn: 1 });
        } else if (dateRangeType === 'month') {
            start = startOfMonth(now);
            end = endOfMonth(now);
        } else if (dateRangeType === 'custom' && date) {
            start = startOfDay(date);
            end = endOfDay(date);
        }

        return { start, end };
    }, [dateRangeType, date]);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();

            // 1. Fetch Orders
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('*, restaurants(name, commission_rate), order_items(quantity, menu_items(name))')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // 2. Fetch Settlements (Processed in this period)
            const { data: settlements, error: settlementsError } = await supabase
                .from('settlements')
                .select('amount, status, created_at')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());

            if (settlementsError) throw settlementsError;

            // 3. Calculate Financials
            const FIXED_PLATFORM_FEE = 8;
            const DEFAULT_DELIVERY_FEE = 25;

            let totalRev = 0;
            let totalPlatFees = 0;
            let totalCommissions = 0;
            let deliveredCount = 0;
            let totalLiabilities = 0; // Payable to partners/shops from these orders

            orders.forEach(order => {
                const total = Number(order.total_amount) || 0;

                if (order.status === 'delivered') {
                    totalRev += total; // Only count revenue for delivered orders
                    deliveredCount++;

                    const dFee = Number(order.delivery_fee) || DEFAULT_DELIVERY_FEE;
                    const commissionRate = order.restaurants?.commission_rate || 15;

                    const subtotal = total - dFee - FIXED_PLATFORM_FEE;
                    const commission = (subtotal * commissionRate) / 100;

                    totalPlatFees += FIXED_PLATFORM_FEE;
                    totalCommissions += commission;

                    // Liability calc
                    const shopEarning = Math.max(0, subtotal - commission);
                    totalLiabilities += shopEarning + dFee; // Assuming delivery fee goes to partner
                }
            });

            // 4. Calculate Settlements
            const totalSettled = settlements?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

            // Note: "Pending" is hard to define for a time range (it's a snapshot state). 
            // Here we show "Liabilities Generated" vs "Settlements Processed" in this period.

            setReportData({
                orders,
                summary: {
                    totalRevenue: totalRev,
                    netEarnings: totalPlatFees + totalCommissions,
                    platformFees: totalPlatFees,
                    commissions: totalCommissions,
                    totalOrders: orders.length,
                    deliveredOrders: deliveredCount
                },
                settlements: {
                    totalSettled,
                    totalPending: totalLiabilities, // Labelled as "Payable Generated"
                    processedCount: settlements?.length || 0
                }
            });

        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    }, [getDateRange]);

    const downloadPDF = () => {
        if (!reportData) return;

        const doc = new jsPDF();
        const { start, end } = getDateRange();
        const dateStr = `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;

        // Title
        doc.setFontSize(20);
        doc.text('Admin Comprehensive Report', 14, 22);
        doc.setFontSize(11);
        doc.text(`Period: ${dateStr}`, 14, 30);
        doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 36);

        // 1. Financial Summary
        doc.text('Financial Summary', 14, 45);
        autoTable(doc, {
            startY: 50,
            head: [['Metric', 'Value']],
            body: [
                ['Total Revenue (GMV)', formatCurrency(reportData.summary.totalRevenue)],
                ['Net Earnings (Profit)', formatCurrency(reportData.summary.netEarnings)],
                ['  - Platform Fees', formatCurrency(reportData.summary.platformFees)],
                ['  - Commissions', formatCurrency(reportData.summary.commissions)],
            ],
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] },
        });

        // 2. Settlements Summary
        doc.text('Settlements & Liabilities', 14, (doc as any).lastAutoTable.finalY + 14);
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Metric', 'Value']],
            body: [
                ['Payable Generated (Liabilities)', formatCurrency(reportData.settlements.totalPending)],
                ['Settlements Processed (Paid)', formatCurrency(reportData.settlements.totalSettled)],
                ['Net Flow (Payable - Paid)', formatCurrency(reportData.settlements.totalPending - reportData.settlements.totalSettled)],
            ],
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }, // blue-500
        });

        // 3. Orders Table
        doc.text(`Order Details (${reportData.summary.totalOrders} Total)`, 14, (doc as any).lastAutoTable.finalY + 14);

        const tableRows = reportData.orders.map(order => [
            order.id.slice(0, 8),
            format(new Date(order.created_at), 'MMM d, HH:mm'),
            order.restaurants?.name || 'Unknown',
            order.status,
            formatCurrency(order.total_amount)
        ]);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['ID', 'Date', 'Shop', 'Status', 'Amount']],
            body: tableRows,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [40, 40, 40] },
        });

        doc.save(`admin_report_${format(start, 'yyyy-MM-dd')}.pdf`);
        toast.success("Report downloaded successfully");
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Export Reports
                        </CardTitle>
                        <Button onClick={downloadPDF} disabled={loading || !reportData?.orders.length}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex gap-2">
                            <Button
                                variant={dateRangeType === 'today' ? 'default' : 'outline'}
                                onClick={() => setDateRangeType('today')}
                            >
                                Today
                            </Button>
                            <Button
                                variant={dateRangeType === 'week' ? 'default' : 'outline'}
                                onClick={() => setDateRangeType('week')}
                            >
                                This Week
                            </Button>
                            <Button
                                variant={dateRangeType === 'month' ? 'default' : 'outline'}
                                onClick={() => setDateRangeType('month')}
                            >
                                This Month
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Custom Date:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={`w-[240px] justify-start text-left font-normal ${!date && "text-muted-foreground"}`}
                                        onClick={() => setDateRangeType('custom')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => {
                                            setDate(d);
                                            setDateRangeType('custom');
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : reportData ? (
                        <div className="space-y-6">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-secondary/10 rounded-lg border">
                                    <p className="text-sm text-muted-foreground">Revenue</p>
                                    <p className="text-2xl font-bold">{formatCurrency(reportData.summary.totalRevenue)}</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                    <p className="text-sm text-green-600">Net Earnings</p>
                                    <p className="text-2xl font-bold text-green-700">{formatCurrency(reportData.summary.netEarnings)}</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-sm text-blue-600">Settled (Paid)</p>
                                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(reportData.settlements.totalSettled)}</p>
                                </div>
                                <div className="p-4 bg-secondary/10 rounded-lg border">
                                    <p className="text-sm text-muted-foreground">Delivered Orders</p>
                                    <p className="text-2xl font-bold">{reportData.summary.deliveredOrders}</p>
                                </div>
                            </div>

                            {/* Detailed Breakdown for Preview */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="rounded-md border p-4">
                                    <h3 className="font-semibold mb-4 text-sm">Financial Breakdown</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Platform Fees</span>
                                            <span className="font-medium text-green-600">+{formatCurrency(reportData.summary.platformFees)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Commissions</span>
                                            <span className="font-medium text-green-600">+{formatCurrency(reportData.summary.commissions)}</span>
                                        </div>
                                        <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                                            <span>Net Earnings</span>
                                            <span>{formatCurrency(reportData.summary.netEarnings)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-md border p-4">
                                    <h3 className="font-semibold mb-4 text-sm">Settlements (This Period)</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Payable Generated</span>
                                            <span>{formatCurrency(reportData.settlements.totalPending)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Actually Settled</span>
                                            <span className="text-blue-600 font-medium">-{formatCurrency(reportData.settlements.totalSettled)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <div className="bg-muted/50 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Recent Orders Preview
                                </div>
                                <table className="w-full text-sm">
                                    <tbody className="divide-y">
                                        {reportData.orders.slice(0, 5).map(order => (
                                            <tr key={order.id} className="hover:bg-muted/5">
                                                <td className="p-3 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                                                <td className="p-3 text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, HH:mm')}</td>
                                                <td className="p-3 max-w-[150px] truncate">{order.restaurants?.name}</td>
                                                <td className="p-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize
                                                        ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-secondary text-secondary-foreground'}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-medium">{formatCurrency(order.total_amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {reportData.orders.length > 5 && (
                                    <div className="p-3 text-center text-xs text-muted-foreground border-t">
                                        Download PDF to view full list of {reportData.orders.length} orders
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
};
