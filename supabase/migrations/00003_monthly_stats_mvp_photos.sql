-- ============================================
-- FSN - Estadísticas mensuales, MVP doble, fotos para todos, perfiles
-- ============================================

-- 1. PHOTOS: cualquier jugador autenticado puede subir fotos (máx. 3 por partido por jugador)
DROP POLICY IF EXISTS "Admins can insert photos" ON photos;
DROP POLICY IF EXISTS "Authenticated users can insert photos" ON photos;

CREATE POLICY "Authenticated users can insert photos"
  ON photos FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND (SELECT COUNT(*) FROM photos p WHERE p.match_id = photos.match_id AND p.profile_id = photos.profile_id) < 3
  );

CREATE POLICY "Owners can delete own photos"
  ON photos FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- 2. AVATARS bucket (foto de perfil)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- 3. MVP VOTES: cada jugador vota 2 veces (2 MVPs) y solo los presentes votan por presentes
-- Se reemplaza el unique (match, voter) por (match, voter, voted)
ALTER TABLE mvp_votes DROP CONSTRAINT IF EXISTS mvp_votes_match_id_voter_id_key;
ALTER TABLE mvp_votes ADD CONSTRAINT mvp_votes_match_voter_voted_key UNIQUE (match_id, voter_id, voted_id);

CREATE OR REPLACE FUNCTION check_mvp_vote()
RETURNS TRIGGER AS $$
DECLARE
  vote_count INT;
  match_status TEXT;
  voter_confirmed BOOLEAN;
  voted_confirmed BOOLEAN;
BEGIN
  SELECT status INTO match_status FROM matches WHERE id = NEW.match_id;
  IF match_status IS DISTINCT FROM 'played' THEN
    RAISE EXCEPTION 'Solo se puede votar en partidos jugados';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM attendance
    WHERE match_id = NEW.match_id AND profile_id = NEW.voter_id AND status = 'confirmed'
  ) INTO voter_confirmed;
  IF NOT voter_confirmed THEN
    RAISE EXCEPTION 'Solo los jugadores presentes pueden votar';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM attendance
    WHERE match_id = NEW.match_id AND profile_id = NEW.voted_id AND status = 'confirmed'
  ) INTO voted_confirmed;
  IF NOT voted_confirmed THEN
    RAISE EXCEPTION 'Solo se puede votar por jugadores presentes';
  END IF;

  IF NEW.voter_id = NEW.voted_id THEN
    RAISE EXCEPTION 'No podés votarte a vos mismo';
  END IF;

  SELECT COUNT(*) INTO vote_count FROM mvp_votes
  WHERE match_id = NEW.match_id AND voter_id = NEW.voter_id;
  IF vote_count >= 2 THEN
    RAISE EXCEPTION 'Ya votaste 2 veces en este partido';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_mvp_vote ON mvp_votes;
CREATE TRIGGER trg_check_mvp_vote
  BEFORE INSERT ON mvp_votes
  FOR EACH ROW EXECUTE FUNCTION check_mvp_vote();

-- 4. TEAM CONFIG: puntos MVP configurables (1º y 2º)
ALTER TABLE team_config
  ADD COLUMN IF NOT EXISTS mvp_points_first INTEGER NOT NULL DEFAULT 3;
ALTER TABLE team_config
  ADD COLUMN IF NOT EXISTS mvp_points_second INTEGER NOT NULL DEFAULT 1;

-- 5. Tabla general anual de MVP (por años, usa los puntos configurados)
CREATE OR REPLACE FUNCTION mvp_standings_for_year(target_year INT)
RETURNS TABLE (
  profile_id UUID,
  name TEXT,
  nickname TEXT,
  points BIGINT,
  mvp_wins BIGINT,
  second_places BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (SELECT mvp_points_first, mvp_points_second FROM team_config LIMIT 1),
  match_ranks AS (
    SELECT
      mv.match_id,
      mv.voted_id,
      COUNT(*) AS votes,
      ROW_NUMBER() OVER (PARTITION BY mv.match_id ORDER BY COUNT(*) DESC, mv.voted_id) AS rn
    FROM mvp_votes mv
    JOIN matches m ON m.id = mv.match_id
    WHERE EXTRACT(YEAR FROM m.date) = target_year
    GROUP BY mv.match_id, mv.voted_id
  )
  SELECT
    mr.voted_id,
    p.name,
    p.nickname,
    SUM(CASE WHEN mr.rn = 1 THEN cfg.mvp_points_first WHEN mr.rn = 2 THEN cfg.mvp_points_second ELSE 0 END)::BIGINT,
    COUNT(*) FILTER (WHERE mr.rn = 1)::BIGINT,
    COUNT(*) FILTER (WHERE mr.rn = 2)::BIGINT
  FROM match_ranks mr
  CROSS JOIN cfg
  JOIN profiles p ON p.id = mr.voted_id
  GROUP BY mr.voted_id, p.name, p.nickname, cfg.mvp_points_first, cfg.mvp_points_second
  ORDER BY SUM(CASE WHEN mr.rn = 1 THEN cfg.mvp_points_first WHEN mr.rn = 2 THEN cfg.mvp_points_second ELSE 0 END) DESC;
$$;

-- 6. Estadísticas mensuales por jugador (goles, asistencias, partidos jugados)
CREATE OR REPLACE FUNCTION player_stats_for_month(target_year INT, target_month INT)
RETURNS TABLE (
  profile_id UUID,
  name TEXT,
  nickname TEXT,
  goals BIGINT,
  assists BIGINT,
  matches BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.nickname,
    COUNT(DISTINCT g.id) FILTER (
      WHERE EXTRACT(YEAR FROM m.date) = target_year AND EXTRACT(MONTH FROM m.date) = target_month
    )::BIGINT,
    COUNT(DISTINCT g2.id) FILTER (
      WHERE EXTRACT(YEAR FROM m2.date) = target_year AND EXTRACT(MONTH FROM m2.date) = target_month
    )::BIGINT,
    COUNT(DISTINCT a.match_id) FILTER (
      WHERE a.status = 'confirmed'
        AND m3.status = 'played'
        AND EXTRACT(YEAR FROM m3.date) = target_year AND EXTRACT(MONTH FROM m3.date) = target_month
    )::BIGINT
  FROM profiles p
  LEFT JOIN goals g ON g.scorer_id = p.id
  LEFT JOIN matches m ON m.id = g.match_id
  LEFT JOIN goals g2 ON g2.assist_id = p.id
  LEFT JOIN matches m2 ON m2.id = g2.match_id
  LEFT JOIN attendance a ON a.profile_id = p.id
  LEFT JOIN matches m3 ON m3.id = a.match_id
  WHERE p.is_active = true
  GROUP BY p.id, p.name, p.nickname;
$$;
