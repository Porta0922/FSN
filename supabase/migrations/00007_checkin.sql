-- ============================================
-- FSN - Check-in por QR / NFC
-- Token aleatorio por partido que habilita confirmar asistencia
-- ============================================

CREATE TABLE IF NOT EXISTS match_checkin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (match_id)
);

ALTER TABLE match_checkin_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkin tokens viewable by admin or creator"
  ON match_checkin_tokens FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR created_by = auth.uid()
    OR (SELECT created_by FROM matches WHERE id = match_id) = auth.uid()
  );

CREATE POLICY "Admins or creators can insert checkin tokens"
  ON match_checkin_tokens FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR (SELECT created_by FROM matches WHERE id = match_id) = auth.uid()
  );

CREATE POLICY "Admins or creators can update checkin tokens"
  ON match_checkin_tokens FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR (SELECT created_by FROM matches WHERE id = match_id) = auth.uid()
  );

CREATE POLICY "Admins or creators can delete checkin tokens"
  ON match_checkin_tokens FOR DELETE TO authenticated
  USING (
    is_admin(auth.uid())
    OR (SELECT created_by FROM matches WHERE id = match_id) = auth.uid()
  );
