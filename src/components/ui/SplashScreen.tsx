import React, { useEffect, useState } from 'react';
import { cn } from "@/lib/utils";

interface SplashScreenProps {
    onFinished?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // Start entry animations
        setIsAnimating(true);

        // After 2.5 seconds, start fade out
        const fadeOutTimer = setTimeout(() => {
            setIsVisible(false);
        }, 2500);

        // After fade out (0.5s duration), call onFinished
        const finishTimer = setTimeout(() => {
            if (onFinished) onFinished();
        }, 3000);

        return () => {
            clearTimeout(fadeOutTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinished]);

    if (!isVisible && !isAnimating) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ease-in-out",
                isVisible ? "opacity-100" : "opacity-0"
            )}
        >
            <div className="flex flex-col items-center space-y-6 animate-in fade-in zoom-in duration-1000 ease-out">
                {/* Branded Logo Text */}
                <div className="flex flex-col items-center">
                    <h1 className="text-6xl md:text-8xl font-serif tracking-tight text-black">
                        Zenjourney
                    </h1>
                    <div className="h-1 w-24 bg-primary mt-4 rounded-full animate-in slide-in-from-left duration-1000 delay-300 fill-mode-both" />
                </div>

                {/* Tagline */}
                <p className="text-lg md:text-xl text-muted-foreground font-medium tracking-wide animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
                    Balance Your Time, Elevate Your Life
                </p>
            </div>

            {/* Subtle bottom text or version */}
            <div className="absolute bottom-12 left-0 right-0 animate-in fade-in duration-1000 delay-1000 fill-mode-both">
                <p className="text-[10px] md:text-sm text-muted-foreground/60 font-medium text-center px-6 uppercase tracking-widest whitespace-pre-line">
                    © 2026 ZenJourney  All rights reserved.{"\n"}
                    "Powered by custom SaaS solutions developed by ZenJourney. Visit zenjourney.in or call 9092406569."
                </p>
            </div>
        </div>
    );
};
