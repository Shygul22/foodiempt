import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount: string;
  image_url: string | null;
  valid_till: string | null;
  tag: string | null;
  is_active: boolean;
  sort_order: number;
}

export function PromotionsManager() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount: '',
    image_url: '',
    valid_till: '',
    tag: 'New',
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    fetchPromotions();

    const channel = supabase
      .channel('admin-promotions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, () => {
        fetchPromotions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setPromotions(data);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('promotion-images')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Failed to upload image');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('promotion-images')
      .getPublicUrl(fileName);

    setFormData({ ...formData, image_url: publicUrl });
    setUploading(false);
    toast.success('Image uploaded!');
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.discount) {
      toast.error('Title and discount are required');
      return;
    }

    if (editingPromo) {
      const { error } = await supabase
        .from('promotions')
        .update(formData)
        .eq('id', editingPromo.id);

      if (error) {
        toast.error('Failed to update promotion');
      } else {
        toast.success('Promotion updated!');
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('promotions')
        .insert([formData]);

      if (error) {
        toast.error('Failed to create promotion');
      } else {
        toast.success('Promotion created!');
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete promotion');
    } else {
      toast.success('Promotion deleted!');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discount: '',
      image_url: '',
      valid_till: '',
      tag: 'New',
      is_active: true,
      sort_order: 0
    });
    setEditingPromo(null);
  };

  const openEditDialog = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title,
      description: promo.description || '',
      discount: promo.discount,
      image_url: promo.image_url || '',
      valid_till: promo.valid_till || '',
      tag: promo.tag || 'New',
      is_active: promo.is_active,
      sort_order: promo.sort_order
    });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Promotions
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPromo ? 'Edit Promotion' : 'Add Promotion'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Weekend Feast"
                />
              </div>
              <div>
                <Label>Discount Text *</Label>
                <Input
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="Up to 40% OFF"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enjoy special discounts..."
                />
              </div>
              <div>
                <Label>Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="flex-1"
                  />
                  {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
                </div>
                {formData.image_url && (
                  <img src={formData.image_url} alt="Preview" className="mt-2 h-20 w-full object-cover rounded" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valid Till</Label>
                  <Input
                    value={formData.valid_till}
                    onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })}
                    placeholder="Every Weekend"
                  />
                </div>
                <div>
                  <Label>Tag</Label>
                  <Input
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="Popular"
                  />
                </div>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
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
                {editingPromo ? 'Update' : 'Create'} Promotion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No promotions yet. Add your first promotion!
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map((promo) => (
              <div key={promo.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {promo.image_url ? (
                  <img src={promo.image_url} alt={promo.title} className="w-16 h-12 object-cover rounded" />
                ) : (
                  <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{promo.title}</p>
                  <p className="text-sm text-muted-foreground">{promo.discount}</p>
                </div>
                <Switch
                  checked={promo.is_active}
                  onCheckedChange={(checked) => toggleActive(promo.id, checked)}
                />
                <Button size="icon" variant="ghost" onClick={() => openEditDialog(promo)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(promo.id)}>
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
