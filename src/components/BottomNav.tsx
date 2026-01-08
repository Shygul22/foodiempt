import { Home, Search, ShoppingBag, User, Compass } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const BottomNav = () => {
    const location = useLocation();

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const navItems = [
        {
            icon: Home,
            label: "Home",
            path: "/",
        },
        {
            icon: Compass,
            label: "Offers",
            path: "/offers",
        },
        {
            icon: ShoppingBag,
            label: "Cart",
            path: "/cart",
        },
        {
            icon: User,
            label: "Profile",
            path: "/profile",
        },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
            <nav className="flex items-center justify-around h-16 px-2">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full space-y-1 text-sm transition-colors duration-200",
                            isActive(item.path)
                                ? "text-primary font-medium bg-secondary/10 rounded-lg"
                                : "text-muted-foreground hover:text-primary"
                        )}
                    >
                        <item.icon
                            size={24}
                            className={cn(
                                "transition-transform duration-200",
                                isActive(item.path) ? "scale-110" : ""
                            )}
                        />
                        <span className="text-[10px]">{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
};

export default BottomNav;
