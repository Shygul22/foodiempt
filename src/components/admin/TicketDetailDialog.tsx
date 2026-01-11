import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth"; // Assuming useAuth exists
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Loader2, User, UserCog } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    user_id: string;
}

interface Message {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    sender?: {
        full_name: string;
        role: string;
    };
}

interface TicketDetailDialogProps {
    ticket: Ticket | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: () => void;
}

export const TicketDetailDialog = ({ ticket, open, onOpenChange, onUpdate }: TicketDetailDialogProps) => {
    const { session } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState(ticket?.status || "open");

    useEffect(() => {
        if (open && ticket) {
            setStatus(ticket.status);
            fetchMessages();
            // Subscribe to new messages for this ticket
            const channel = supabase
                .channel(`ticket-${ticket.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'support_messages',
                        filter: `ticket_id=eq.${ticket.id}`
                    },
                    (payload) => {
                        console.log('New message received:', payload);
                        fetchMessages(); // Refresh messages on new insert
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [open, ticket, fetchMessages]);

    const fetchMessages = useCallback(async () => {
        if (!ticket) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("support_messages")
                .select(`
                    *,
                    sender:profiles!support_messages_sender_id_fkey(full_name, role)
                `)
                .eq("ticket_id", ticket.id)
                .order("created_at", { ascending: true });

            if (error) throw error;
            setMessages((data || []) as Message[]);
        } catch (error) {
            console.error("Error fetching messages:", error);
            toast.error("Failed to load messages");
        } finally {
            setLoading(false);
        }
    }, [ticket]);

    const sendReply = async () => {
        if (!reply.trim() || !session?.user) return;
        setSending(true);
        try {
            const { error } = await supabase
                .from("support_messages")
                .insert({
                    ticket_id: ticket.id,
                    sender_id: session.user.id,
                    message: reply.trim()
                });

            if (error) throw error;

            // Optional: Auto-update status to 'in_progress' if it was 'open'
            if (status === 'open') {
                await updateStatus('in_progress');
            }

            setReply("");
            fetchMessages();
            toast.success("Reply sent");
        } catch (error) {
            console.error("Error sending reply:", error);
            toast.error("Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        try {
            const { error } = await supabase
                .from("support_tickets")
                .update({ status: newStatus })
                .eq("id", ticket.id);

            if (error) throw error;
            setStatus(newStatus);
            onUpdate(); // Refresh parent list
            toast.success(`Ticket marked as ${newStatus.replace('_', ' ')}`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl">{ticket?.subject}</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Ticket #{ticket?.id.slice(0, 8)} • {ticket?.priority} Priority
                            </p>
                        </div>
                        <Select value={status} onValueChange={updateStatus}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden border rounded-md bg-muted/10 p-4">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10">No messages yet</p>
                            ) : (
                                messages.map((msg) => {
                                    // Determine if the message is from the customer (ticket creator) or support
                                    const isCustomer = msg.sender_id === ticket.user_id;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex gap-3 ${isCustomer ? "" : "flex-row-reverse"}`}
                                        >
                                            <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 
                                                ${isCustomer ? "bg-blue-100 text-blue-600" : "bg-primary text-primary-foreground"}`}>
                                                {isCustomer ? <User size={14} /> : <UserCog size={14} />}
                                            </div>
                                            <div className={`flex flex-col max-w-[80%] ${isCustomer ? "items-start" : "items-end"}`}>
                                                <div className={`rounded-lg p-3 text-sm 
                                                    ${isCustomer
                                                        ? "bg-white border text-foreground"
                                                        : "bg-primary text-primary-foreground"
                                                    }`}>
                                                    {msg.message}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                                    {msg.sender?.full_name || 'User'} • {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="mt-4">
                    <div className="w-full flex gap-2">
                        <Textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 min-h-[60px]"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendReply();
                                }
                            }}
                        />
                        <Button
                            onClick={sendReply}
                            disabled={sending || !reply.trim()}
                            className="h-auto"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
