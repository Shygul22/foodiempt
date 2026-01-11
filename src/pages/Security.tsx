import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, Lock, Key, Trash2, Smartphone, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";

interface MFAFactor {
    id: string;
    status: 'verified' | 'unverified';
    factor_type: 'totp';
    friendly_name?: string;
}

const SecurityPage = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Password Change State
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // MFA State
    const [factors, setFactors] = useState<MFAFactor[]>([]);
    const [mfaLoading, setMfaLoading] = useState(true);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollData, setEnrollData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);

    const fetchMfaFactors = useCallback(async () => {
        try {
            setMfaLoading(true);
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            setFactors(data.all as MFAFactor[]);
        } catch (error: any) {
            console.error('Error fetching MFA factors:', error);
            toast.error('Failed to load security settings');
        } finally {
            setMfaLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                navigate('/auth');
                return;
            }
            fetchMfaFactors();
        }
    }, [user, authLoading, navigate, fetchMfaFactors]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        try {
            setPasswordLoading(true);
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast.success('Password updated successfully');
            setPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleEnrollMfa = async () => {
        try {
            setIsEnrolling(true);
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'My App TOTP'
            });
            if (error) throw error;

            setEnrollData({
                id: data.id,
                qr_code: data.totp.qr_code,
                secret: data.totp.secret
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to start MFA enrollment');
            setIsEnrolling(false);
        }
    };

    const handleVerifyMfa = async () => {
        if (!enrollData || verifyCode.length !== 6) return;

        try {
            setVerifyLoading(true);

            // Step 1: Challenge
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: enrollData.id
            });
            if (challengeError) throw challengeError;

            // Step 2: Verify
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: challengeData.id,
                code: verifyCode
            });
            if (verifyError) throw verifyError;

            toast.success('MFA enrolled successfully');
            setEnrollData(null);
            setIsEnrolling(false);
            setVerifyCode('');
            fetchMfaFactors();
        } catch (error: any) {
            toast.error(error.message || 'Invalid verification code');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleUnenrollMfa = async (factorId: string) => {
        if (!confirm('Are you sure you want to disable this authentication method?')) return;

        try {
            setMfaLoading(true);
            const { error } = await supabase.auth.mfa.unenroll({ factorId });
            if (error) throw error;
            toast.success('Authentication method removed');
            fetchMfaFactors();
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove MFA method');
        } finally {
            setMfaLoading(false);
        }
    };

    if (authLoading) return null;

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link to="/profile" className="text-foreground hover:text-primary transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold">Security Settings</h1>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
                {/* MFA Section */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Two-Factor Authentication (MFA)
                        </CardTitle>
                        <CardDescription>
                            Add an extra layer of security to your account using TOTP (Google Authenticator, Authy, etc.).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {mfaLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : factors.length > 0 ? (
                            <div className="space-y-4">
                                {factors.map((factor) => (
                                    <div key={factor.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                                        <div className="flex items-center gap-3">
                                            <Smartphone className="w-5 h-5 text-primary" />
                                            <div>
                                                <p className="font-medium">{factor.friendly_name || 'Authenticator App'}</p>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{factor.status}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleUnenrollMfa(factor.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                                <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">MFA is currently disabled.</p>
                                {!isEnrolling && (
                                    <Button className="mt-4" onClick={handleEnrollMfa}>
                                        Enable MFA
                                    </Button>
                                )}
                            </div>
                        )}

                        {isEnrolling && enrollData && (
                            <div className="mt-6 p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-6 animate-in fade-in slide-in-from-top-4">
                                <div className="text-center space-y-2">
                                    <h3 className="font-bold text-lg">Set up Authenticator App</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Scan the QR code below using your authenticator app.
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-4">
                                    <div className="bg-white p-4 rounded-lg shadow-inner">
                                        <img
                                            src={enrollData.qr_code}
                                            alt="MFA QR Code"
                                            className="w-48 h-48"
                                        />
                                    </div>
                                    <div className="w-full max-w-xs space-y-2">
                                        <Label className="text-xs text-muted-foreground">Secret Key (Manual Entry)</Label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                                                {enrollData.secret}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(enrollData.secret);
                                                    toast.success('Secret copied');
                                                }}
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="space-y-2 text-center">
                                        <Label>Verification Code</Label>
                                        <div className="flex justify-center">
                                            <InputOTP
                                                maxLength={6}
                                                value={verifyCode}
                                                onChange={setVerifyCode}
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
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={handleVerifyMfa}
                                            disabled={verifyCode.length !== 6 || verifyLoading}
                                        >
                                            {verifyLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : 'Verify & Enable'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsEnrolling(false);
                                                setEnrollData(null);
                                                setVerifyCode('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Password Change Section */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-primary" />
                            Change Password
                        </CardTitle>
                        <CardDescription>
                            Update your account password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={passwordLoading} className="w-full">
                                {passwordLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : 'Update Password'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Security Notice */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold">Important</p>
                        <p>If you lose access to your MFA device, you may be locked out of your account. Please ensure you have backed up your recovery codes if available.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityPage;
