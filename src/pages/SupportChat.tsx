import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { GlobalLoading } from '@/components/ui/GlobalLoading';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
    id: string;
    sender_id: string;
    message: string;
    created_at: string;
    sender_profile?: {
        full_name: string;
        avatar_url: string | null;
    };
}

interface Ticket {
    id: string;
    subject: string;
    status: string;
}

const SupportChat = () => {
    const { id } = useParams<{ id: string }>();
    const { session, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id && session?.user?.id) {
            fetchTicketDetails();
            fetchMessages();
            subscribeToMessages();
        }
    }, [id, session]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    const fetchTicketDetails = async () => {
        const { data } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("id", id)
            .single();
        setTicket(data);
    };

    const fetchMessages = async () => {
        try {
            const { data: messagesData, error } = await supabase
                .from("support_messages")
                .select("*")
                .eq("ticket_id", id)
                .order("created_at", { ascending: true });

            if (error) throw error;

            const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", senderIds);

            const populatedMessages = messagesData.map(msg => ({
                ...msg,
                sender_profile: profilesData?.find(p => p.id === msg.sender_id)
            }));

            setMessages(populatedMessages);
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel(`support_messages:${id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "support_messages",
                    filter: `ticket_id=eq.${id}`,
                },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("id, full_name, avatar_url")
                        .eq("id", payload.new.sender_id)
                        .single();

                    const newMsg = {
                        ...(payload.new as any),
                        sender_profile: profile
                    } as Message;

                    setMessages((prev) => [...prev, newMsg]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !session?.user?.id) return;

        try {
            const { error } = await supabase.from("support_messages").insert({
                ticket_id: id,
                sender_id: session.user.id,
                message: newMessage,
            });

            if (error) throw error;
            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
        }
    };

    if (!session) return null;

    if (authLoading || loading) {
        return <GlobalLoading message="Restoring conversation..." />;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b p-4 flex items-center gap-4 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h2 className="font-semibold">{ticket?.subject || "Support Chat"}</h2>
                    <p className="text-xs text-gray-500">
                        Ticket ID: {id?.slice(0, 8)}... | Status:{" "}
                        <span className="capitalize">{ticket?.status?.replace("_", " ")}</span>
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 pb-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">No messages yet.</div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.sender_id === session.user.id;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={msg.sender_profile?.avatar_url || ""} />
                                        <AvatarFallback>{msg.sender_profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={`max-w-[80%] rounded-lg p-3 ${isMe
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-white border text-gray-800"
                                            }`}
                                    >
                                        {!isMe && <div className="text-xs font-semibold mb-1 opacity-70">{msg.sender_profile?.full_name}</div>}
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                        <div
                                            className={`text-[10px] mt-1 text-right ${isMe ? "text-primary-foreground/70" : "text-gray-400"
                                                }`}
                                        >
                                            {new Date(msg.created_at).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            {ticket?.status !== "closed" && (
                <div className="p-4 bg-white border-t mt-auto">
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1"
                        />
                        <Button type="submit" disabled={!newMessage.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            )}
            {ticket?.status === "closed" && (
                <div className="p-4 bg-gray-100 border-t text-center text-gray-500 text-sm">
                    This ticket is closed. You cannot send further messages.
                </div>
            )}
        </div>
    );
};

export default SupportChat;
