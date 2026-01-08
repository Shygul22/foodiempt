import React, { useState, useEffect, forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  Heart,
  Settings,
  LogOut,
  FileText,
  Gift,
  Users,
  Shield,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
}

const ProfilePage = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '' });
  const [stats, setStats] = useState({ orders: 0, favourites: 0 });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchProfile();
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    try {
      const [profileRes, ordersRes, favRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
        supabase.from('orders').select('id').eq('customer_id', user!.id),
        supabase.from('favourite_shops').select('id').eq('user_id', user!.id)
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setFormData({
          full_name: profileRes.data.full_name || '',
          phone: profileRes.data.phone || ''
        });
      }

      setStats({
        orders: ordersRes.data?.length || 0,
        favourites: favRes.data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone
      })
      .eq('id', user!.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
      setEditing(false);
      fetchProfile();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const menuItems = [
    { icon: Package, label: 'My Orders', href: '/orders' },
    { icon: Heart, label: 'Favourites', href: '/?favourites=true' },
    { icon: MapPin, label: 'Addresses', href: '/?addresses=true' },
    { icon: Gift, label: 'Offers', href: '/offers' },
    { icon: Users, label: 'Refer & Earn', href: '/refer' },
  ];

  const policyItems = [
    { icon: FileText, label: 'Terms & Conditions', href: '/terms' },
    { icon: Shield, label: 'Privacy Policy', href: '/privacy' },
    { icon: FileText, label: 'Refund Policy', href: '/refund' },
  ];

  return (
    <div ref={ref} className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Profile Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3">
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Full Name"
                    />
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone Number"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateProfile}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{profile?.full_name || 'Set your name'}</h2>
                    <p className="text-muted-foreground text-sm">{profile?.email}</p>
                    {profile?.phone ? (
                      <p className="text-muted-foreground text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {profile.phone}
                      </p>
                    ) : (
                      <p className="text-destructive text-sm flex items-center gap-1 font-medium">
                        <Phone className="w-3 h-3" /> Mobile required for orders
                      </p>
                    )}
                    <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setEditing(true)}>
                      <Settings className="w-4 h-4 mr-1" /> Edit Profile
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.orders}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-accent">{stats.favourites}</p>
                <p className="text-sm text-muted-foreground">Favourites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <Link 
                key={item.label} 
                to={item.href}
                className={`flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors ${
                  index !== menuItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Policy Items */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Legal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {policyItems.map((item, index) => (
              <Link 
                key={item.label} 
                to={item.href}
                className={`flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors ${
                  index !== policyItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button 
          variant="outline" 
          className="w-full text-destructive border-destructive/20 hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
});

ProfilePage.displayName = 'ProfilePage';

export default ProfilePage;
