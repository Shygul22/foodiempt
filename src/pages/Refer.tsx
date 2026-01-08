import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2, Copy, Users, Gift, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Refer() {
  const { user } = useAuth();
  const referralCode = user?.id?.slice(0, 8).toUpperCase() || 'REFER123';
  
  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Referral code copied!');
  };

  const shareCode = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join our Food Delivery App!',
        text: `Use my referral code ${referralCode} to get ₹100 off on your first order!`,
        url: window.location.origin
      });
    } else {
      copyCode();
    }
  };

  const steps = [
    { icon: Share2, title: 'Share Code', description: 'Share your referral code with friends' },
    { icon: Users, title: 'Friend Signs Up', description: 'They sign up using your code' },
    { icon: Gift, title: 'Both Earn', description: 'You get ₹100, they get ₹100!' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Refer & Earn</h1>
              <p className="text-sm text-muted-foreground">Invite friends, earn rewards</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Hero Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-primary to-accent text-white overflow-hidden">
          <CardContent className="p-6 text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <Gift className="w-16 h-16 mx-auto mb-4 relative z-10" />
            <h2 className="text-2xl font-bold relative z-10">Earn ₹100</h2>
            <p className="text-white/90 mt-2 relative z-10">For every friend who orders using your referral code</p>
            
            <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-xl p-4 relative z-10">
              <p className="text-sm text-white/80 mb-2">Your Referral Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-bold tracking-wider">{referralCode}</span>
                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={copyCode}>
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Button */}
        <Button className="w-full" size="lg" onClick={shareCode}>
          <Share2 className="w-5 h-5 mr-2" />
          Share Your Code
        </Button>

        {/* How it works */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="pt-1">
                  <h4 className="font-semibold">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute left-10 top-14 w-0.5 h-8 bg-border" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Rewards Summary */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground">Total Referrals</p>
              <p className="text-4xl font-bold text-primary mt-1">0</p>
              <p className="text-sm text-muted-foreground mt-2">Invite friends to start earning!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
