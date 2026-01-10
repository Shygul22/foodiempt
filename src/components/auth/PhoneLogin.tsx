import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { auth } from '@/integrations/firebase/client';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { supabase } from '@/integrations/supabase/client';

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
    }
}

export const PhoneLogin = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    useEffect(() => {
        // Cleanup recaptcha on unmount
        return () => {
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
            }
        };
    }, []);

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': () => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber.
                }
            });
        }
    };

    const exchangeFirebaseToken = async (firebaseUser: any) => {
        try {
            const idToken = await firebaseUser.getIdToken();
            const { data, error } = await supabase.functions.invoke('verify-firebase-token', {
                body: { firebaseToken: idToken }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // Set Supabase Session
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.access_token // Using same for now, or handle refresh logic
            });

            if (sessionError) throw sessionError;

            toast.success('Synced with Supabase successfully!');
        } catch (err) {
            console.error('Bridge Error:', err);
            toast.error('Login successful, but data sync failed.');
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            setupRecaptcha();
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            const appVerifier = window.recaptchaVerifier;

            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            setConfirmationResult(confirmation);
            setStep('otp');
            toast.success('OTP sent successfully!');
        } catch (error: any) {
            console.error('Error sending OTP:', error);
            toast.error(error.message || 'Failed to send OTP. Please try again.');
            // Reset recaptcha on error so user can try again
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                // @ts-ignore
                window.recaptchaVerifier = null;
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult || otp.length !== 6) return;

        setLoading(true);
        try {
            const result = await confirmationResult.confirm(otp);
            const user = result.user;
            console.log('User signed in:', user);

            // Auto-exchange token
            await exchangeFirebaseToken(user);

            toast.success('Successfully logged in!');
        } catch (error: any) {
            console.error('Error verifying OTP:', error);
            toast.error('Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div id="recaptcha-container"></div>

            {step === 'phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-4 animate-fade-in">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="9876543210"
                                className="pl-10"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            We'll send you a 6-digit code to verify directly.
                        </p>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || phoneNumber.length < 10}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending OTP...
                            </>
                        ) : (
                            <>
                                Send OTP
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                    <div className="space-y-2">
                        <Label>Enter OTP</Label>
                        <div className="flex justify-center py-2">
                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={(value) => setOtp(value)}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                            Enter the code sent to {phoneNumber}
                        </p>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Verify & Login'
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setStep('phone')}
                        disabled={loading}
                    >
                        Change Phone Number
                    </Button>
                </form>
            )}
        </div>
    );
};
