import React from 'react';
import { Loader2 } from 'lucide-react';

interface GlobalLoadingProps {
    message?: string;
}

export const GlobalLoading: React.FC<GlobalLoadingProps> = ({ message = "Loading..." }) => {
    return (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="absolute inset-0 h-12 w-12 border-4 border-primary/20 rounded-full" />
                </div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">
                    {message}
                </p>
            </div>

            <div className="absolute bottom-12 left-0 right-0 animate-in fade-in duration-1000 delay-500 fill-mode-both">
                <p className="text-[10px] text-muted-foreground/60 font-medium text-center px-6">
                    "Powered by custom SaaS solutions developed by ZenJourney. Visit zenjourney.in or call 9092406569."
                </p>
            </div>
        </div>
    );
};
