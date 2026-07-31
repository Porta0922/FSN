-- ============================================
-- FSN - Correcciones y nuevas funcionalidades
-- ============================================

-- 1. DELETE policies para goles y fotos (los botones de borrar existían pero RLS los bloqueaba)
CREATE POLICY "Admins can delete goals"
  ON goals FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete photos"
  ON photos FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 2. Admin UPDATE para asistencias (necesario para marcar no_show de otros jugadores)
CREATE POLICY "Admins can update all attendance"
  ON attendance FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Storage buckets (fotos públicas, comprobantes públicos por el modelo transparente de la app)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Authenticated can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- 4. Vista de estadísticas de jugadores (evita el N+1 de la página de stats)
CREATE VIEW player_stats AS
SELECT
  p.id,
  p.name,
  p.nickname,
  p.is_active,
  COUNT(DISTINCT g.id) FILTER (WHERE g.scorer_id = p.id) AS goals,
  COUNT(DISTINCT g2.id) FILTER (WHERE g2.assist_id = p.id) AS assists,
  COUNT(DISTINCT a.match_id) FILTER (WHERE a.status = 'confirmed') AS matches
FROM profiles p
LEFT JOIN goals g ON g.scorer_id = p.id
LEFT JOIN goals g2 ON g2.assist_id = p.id
LEFT JOIN attendance a ON a.profile_id = p.id
GROUP BY p.id, p.name, p.nickname, p.is_active;
