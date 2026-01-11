import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Ticket {
    id: string;
    subject: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    created_at: string;
    assignee?: {
        full_name: string;
    };
}

const Support = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [newTicket, setNewTicket] = useState<{
        subject: string;
        priority: "low" | "medium" | "high" | "urgent";
        message: string;
    }>({
        subject: "",
        priority: "low",
        message: "",
    });

    useEffect(() => {
        fetchTickets();
    }, [session]);

    const fetchTickets = async () => {
        if (!session?.user?.id) return;
        try {
            const { data, error } = await supabase
                .from("support_tickets")
                .select(`
                    *,
                    assignee:profiles!support_tickets_assigned_to_fkey(full_name)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Transform data to match Ticket interface (handle array response from joins)
            const formattedTickets = (data || []).map((ticket: any) => ({
                ...ticket,
                assignee: Array.isArray(ticket.assignee) ? ticket.assignee[0] : ticket.assignee
            }));

            setTickets(formattedTickets);
        } catch (error) {
            console.error("Error fetching tickets:", error);
            toast.error(`Failed to load tickets: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const createTicket = async () => {
        if (!session?.user?.id) return;
        if (!newTicket.subject.trim() || !newTicket.message.trim()) {
            toast.error("Please fill in all fields");
            return;
        }

        try {
            // 1. Create Ticket
            const { data: ticket, error: ticketError } = await supabase
                .from("support_tickets")
                .insert({
                    user_id: session.user.id,
                    subject: newTicket.subject,
                    priority: newTicket.priority,
                    status: "open",
                })
                .select()
                .single();

            if (ticketError) throw ticketError;

            // 2. Create Initial Message
            const { error: messageError } = await supabase
                .from("support_messages")
                .insert({
                    ticket_id: ticket.id,
                    sender_id: session.user.id,
                    message: newTicket.message,
                });

            if (messageError) throw messageError;

            toast.success("Ticket created successfully");
            setIsOpen(false);
            setNewTicket({ subject: "", priority: "low", message: "" });
            fetchTickets();
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to create ticket");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open":
                return "bg-green-100 text-green-800";
            case "in_progress":
                return "bg-blue-100 text-blue-800";
            case "resolved":
                return "bg-purple-100 text-purple-800";
            case "closed":
                return "bg-gray-100 text-gray-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    if (!session) return null;

    return (
        <div className="container mx-auto p-4 max-w-4xl space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Customer Support</h1>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Ticket
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Support Ticket</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Subject</Label>
                                <Input
                                    id="subject"
                                    value={newTicket.subject}
                                    onChange={(e) =>
                                        setNewTicket({ ...newTicket, subject: e.target.value })
                                    }
                                    placeholder="What do you need help with?"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select
                                    value={newTicket.priority}
                                    onValueChange={(val: "low" | "medium" | "high" | "urgent") =>
                                        setNewTicket({ ...newTicket, priority: val })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    value={newTicket.message}
                                    onChange={(e) =>
                                        setNewTicket({ ...newTicket, message: e.target.value })
                                    }
                                    placeholder="Describe your issue..."
                                    rows={4}
                                />
                            </div>
                            <Button onClick={createTicket} className="w-full">
                                Submit Ticket
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div>Loading tickets...</div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No support tickets found. Create one to get started.
                    </div>
                ) : (
                    tickets.map((ticket) => (
                        <Card
                            key={ticket.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => navigate(`/support/${ticket.id}`)}
                        >
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Created on {new Date(ticket.created_at).toLocaleDateString()}
                                        </div>
                                        {ticket.assignee && (
                                            <div className="text-xs text-blue-600 mt-2 font-medium">
                                                Assigned to: {ticket.assignee.full_name || 'Support Agent'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                ticket.status
                                            )}`}
                                        >
                                            {ticket.status.replace("_", " ").toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-400 capitalize">
                                            {ticket.priority} Priority
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default Support;
