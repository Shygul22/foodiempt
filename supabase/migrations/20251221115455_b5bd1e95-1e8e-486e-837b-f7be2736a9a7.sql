-- Create storage bucket for shop images
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view shop images (public bucket)
CREATE POLICY "Anyone can view shop images"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-images');

-- Allow shop owners to upload their own images
CREATE POLICY "Shop owners can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);

-- Allow shop owners to update their own images
CREATE POLICY "Shop owners can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);

-- Allow shop owners to delete their own images
CREATE POLICY "Shop owners can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);