import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MessageSquare, Filter } from "lucide-react";
import { format } from "date-fns";
import { TicketDetailDialog } from "./TicketDetailDialog";

interface Ticket {
    id: string;
    subject: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    created_at: string;
    user: {
        full_name: string;
        email: string;
    };
}

export const AdminSupport = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");

    // Dialog state
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        fetchTickets();

        // Subscribe to new tickets
        const channel = supabase
            .channel('admin-tickets')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_tickets' },
                () => fetchTickets()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchTickets]);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("support_tickets")
                .select(`
                    *,
                    user:profiles!support_tickets_user_id_fkey(full_name, email)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Map the joined data correctly
            const formattedData = (data || []).map((t: Record<string, any>) => ({
                ...t,
                user: t.user || { full_name: 'Unknown', email: '-' }
            })) as Ticket[];

            setTickets(formattedData);
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            open: "bg-green-100 text-green-800 hover:bg-green-100",
            in_progress: "bg-blue-100 text-blue-800 hover:bg-blue-100",
            resolved: "bg-purple-100 text-purple-800 hover:bg-purple-100",
            closed: "bg-gray-100 text-gray-800 hover:bg-gray-100",
        };
        return <Badge className={styles[status] || ""} variant="outline">{status.replace("_", " ").toUpperCase()}</Badge>;
    };

    const getPriorityBadge = (priority: string) => {
        const styles: Record<string, string> = {
            urgent: "text-red-600 font-bold",
            high: "text-orange-600 font-medium",
            medium: "text-blue-600",
            low: "text-gray-600",
        };
        return <span className={`text-xs uppercase ${styles[priority]}`}>{priority}</span>;
    };

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch =
            ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tickets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Support Tickets
                        <Badge variant="secondary" className="ml-2">{filteredTickets.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredTickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No tickets found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell className="font-medium max-w-[200px] truncate">
                                            {ticket.subject}
                                            <div className="text-xs text-muted-foreground md:hidden">#{ticket.id.slice(0, 8)}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{ticket.user.full_name}</span>
                                                <span className="text-xs text-muted-foreground">{ticket.user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedTicket(ticket);
                                                    setIsDialogOpen(true);
                                                }}
                                            >
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <TicketDetailDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                ticket={selectedTicket}
                onUpdate={fetchTickets}
            />
        </div>
    );
};
