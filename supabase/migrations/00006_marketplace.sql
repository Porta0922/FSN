-- ============================================
-- FSN - Marketplace de merchandising
-- ============================================

-- 1. PRODUCTOS: items de merchandising con foto y precio
CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,0) NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketplace items are viewable by authenticated"
  ON marketplace_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert marketplace items"
  ON marketplace_items FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update marketplace items"
  ON marketplace_items FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete marketplace items"
  ON marketplace_items FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Storage bucket público para fotos de productos
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace', 'marketplace', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload marketplace images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND is_admin(auth.uid()));
