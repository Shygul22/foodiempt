import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  valid_till: string | null;
  discount_type: string | null;
  discount_value: number | null;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
}

export function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    valid_till: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    max_discount_amount: 0,
    is_active: true,
    usage_limit: 0
  });

  useEffect(() => {
    fetchCoupons();

    const channel = supabase
      .channel('admin-coupons')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchCoupons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCoupons(data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.title) {
      toast.error('Code and title are required');
      return;
    }

    const submitData = {
      ...formData,
      max_discount_amount: formData.max_discount_amount || null,
      usage_limit: formData.usage_limit || null
    };

    if (editingCoupon) {
      const { error } = await supabase
        .from('coupons')
        .update(submitData)
        .eq('id', editingCoupon.id);

      if (error) {
        toast.error('Failed to update coupon');
      } else {
        toast.success('Coupon updated!');
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('coupons')
        .insert([submitData]);

      if (error) {
        if (error.code === '23505') {
          toast.error('Coupon code already exists');
        } else {
          toast.error('Failed to create coupon');
        }
      } else {
        toast.success('Coupon created!');
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete coupon');
    } else {
      toast.success('Coupon deleted!');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      title: '',
      description: '',
      valid_till: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      max_discount_amount: 0,
      is_active: true,
      usage_limit: 0
    });
    setEditingCoupon(null);
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      valid_till: coupon.valid_till || '',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value || 0,
      min_order_amount: coupon.min_order_amount || 0,
      max_discount_amount: coupon.max_discount_amount || 0,
      is_active: coupon.is_active,
      usage_limit: coupon.usage_limit || 0
    });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Percent className="w-5 h-5" />
          Coupons
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Add Coupon'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE50"
                  />
                </div>
                <div>
                  <Label>Discount Type</Label>
                  <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="50% OFF on First Order"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Get 50% off up to ₹100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Value</Label>
                  <Input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label>Min Order Amount</Label>
                  <Input
                    type="number"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="199"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Discount</Label>
                  <Input
                    type="number"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Usage Limit (0 = unlimited)</Label>
                  <Input
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 0 })}
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <Label>Valid Till</Label>
                <Input
                  value={formData.valid_till}
                  onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })}
                  placeholder="Valid till 31st Jan"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingCoupon ? 'Update' : 'Create'} Coupon
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No coupons yet. Add your first coupon!
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-16 h-12 bg-primary/10 rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{coupon.code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{coupon.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`}
                    {coupon.usage_limit ? ` • ${coupon.used_count}/${coupon.usage_limit} used` : ''}
                  </p>
                </div>
                <Switch
                  checked={coupon.is_active}
                  onCheckedChange={(checked) => toggleActive(coupon.id, checked)}
                />
                <Button size="icon" variant="ghost" onClick={() => openEditDialog(coupon)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(coupon.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
