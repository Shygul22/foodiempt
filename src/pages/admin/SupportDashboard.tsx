import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Ticket {
    id: string;
    user_id: string;
    subject: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    created_at: string;
    assigned_to: string | null;
    profile?: {
        full_name: string;
        email: string;
        phone: string;
    };
    assignee?: {
        full_name: string;
        email: string;
    };
}

const SupportDashboard = () => {
    const { session, user } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");

    useEffect(() => {
        fetchTickets();
    }, [session, filterStatus]);

    const fetchTickets = async () => {
        try {
            let query = supabase
                .from("support_tickets")
                .select(`
          *,
          profile:profiles!support_tickets_user_id_fkey(full_name, email, phone),
          assignee:profiles!support_tickets_assigned_to_fkey(full_name, email)
        `)
                .order("created_at", { ascending: false });

            if (filterStatus !== "all") {
                query = query.eq("status", filterStatus as any);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Transform data to match interface
            const transformedTickets = (data || []).map((t: any) => ({
                ...t,
                profile: t.profile // profile is now an object, not an array because of the FK relationship? Wait, profiles is 1:1 with users but users:tickets is 1:N. The query returns profile for the user_id.
                // Supabase join normally returns an object if 1:1 or 1:N. Profiles is 1:1 on user_id.
            }));

            setTickets(transformedTickets);
        } catch (error) {
            console.error("Error fetching tickets:", error);
            toast.error(`Failed to load tickets: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const updateTicketStatus = async (ticketId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: newStatus as any })
                .eq('id', ticketId);

            if (error) throw error;

            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus as any } : t));
            toast.success(`Ticket status updated to ${newStatus}`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    }

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'open': return 'default'; // primary
            case 'in_progress': return 'secondary';
            case 'resolved': return 'outline'; // green-ish?
            case 'closed': return 'destructive';
            default: return 'outline';
        }
    }

    const handleAssign = async (ticketId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from("support_tickets")
            .update({ assigned_to: user.id, status: 'in_progress' } as any)
            .eq("id", ticketId);

        if (error) {
            toast.error("Failed to claim ticket");
        } else {
            toast.success("Ticket claimed successfully");
            fetchTickets();
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
            case "urgent":
                return "text-red-600 font-bold";
            case "medium":
                return "text-amber-600";
            default:
                return "text-gray-600";
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Support Panel</h1>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filter Status:</span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tickets</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div>Loading tickets...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Assigned To</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tickets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">No tickets found</TableCell>
                                    </TableRow>
                                ) : (
                                    tickets.map((ticket) => (
                                        <TableRow key={ticket.id} className="cursor-pointer hover:bg-gray-50" onClick={() => {
                                            // Check path to keep user in same context (admin or staff)
                                            const isStaff = window.location.pathname.includes('/staff');
                                            navigate(isStaff ? `/staff/support/${ticket.id}` : `/admin/support/${ticket.id}`);
                                        }}>
                                            <TableCell>
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                                <div className="text-xs text-gray-500">
                                                    {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{ticket.profile?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-muted-foreground">{ticket.profile?.email}</div>
                                                <div className="text-xs text-muted-foreground">{ticket.profile?.phone}</div>
                                            </TableCell>
                                            <TableCell>
                                                {ticket.assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-xs">
                                                            {ticket.assignee.full_name || 'Staff'}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAssign(ticket.id);
                                                        }}
                                                    >
                                                        Claim
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{ticket.subject}</TableCell>
                                            <TableCell>
                                                <span className={getPriorityColor(ticket.priority)}>
                                                    {ticket.priority.toUpperCase()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(ticket.status) as any}>
                                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Select
                                                    defaultValue={ticket.status}
                                                    onValueChange={(val) => updateTicketStatus(ticket.id, val)}
                                                >
                                                    <SelectTrigger className="h-8 w-[130px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="open">Open</SelectItem>
                                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                                        <SelectItem value="resolved">Resolved</SelectItem>
                                                        <SelectItem value="closed">Closed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SupportDashboard;
