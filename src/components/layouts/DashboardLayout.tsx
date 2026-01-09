import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    Menu,
    LogOut,
    User,
    Bell,
    Search,
    Home
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItem {
    label: string;
    value: string;
    icon: React.ElementType;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    navItems: NavItem[];
    activeTab: string;
    onTabChange: (value: string) => void;
    title: string;
    userProfile?: {
        name: string | null;
        email: string | null;
        image?: string | null;
    };
}

export function DashboardLayout({
    children,
    navItems,
    activeTab,
    onTabChange,
    title,
    userProfile
}: DashboardLayoutProps) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const NavContent = ({ mobile = false }) => (
        <div className="flex flex-col h-full gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link to="/" className="flex items-center gap-2 font-semibold">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                        F
                    </div>
                    <span className="">Foodie POS</span>
                </Link>
                {mobile && (
                    <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsMobileMenuOpen(false)}>
                        <Menu className="h-5 w-5" />
                    </Button>
                )}
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    {navItems.map((item) => (
                        <button
                            key={item.value}
                            onClick={() => {
                                onTabChange(item.value);
                                if (mobile) setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                activeTab === item.value
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="mt-auto p-4 border-t">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={userProfile?.image || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                            {userProfile?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate">{userProfile?.name || 'User'}</span>
                        <span className="text-xs text-muted-foreground truncate">{userProfile?.email}</span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={handleSignOut}
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            {/* Sidebar for Desktop */}
            <div className="hidden border-r bg-muted/40 md:block">
                <NavContent />
            </div>

            <div className="flex flex-col">
                {/* Header */}
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 sticky top-0 z-50">
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 md:hidden"
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle navigation menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col p-0">
                            <NavContent mobile />
                        </SheetContent>
                    </Sheet>

                    <div className="w-full flex-1">
                        <h1 className="text-lg font-semibold md:text-xl truncate">{title}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Search className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 border border-background"></span>
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full md:hidden">
                            <User className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/10">
                    {children}
                </main>
            </div>
        </div>
    );
}
