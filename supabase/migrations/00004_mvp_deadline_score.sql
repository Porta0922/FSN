-- ============================================
-- FSN - Cierre de votación MVP, marcador de partidos
-- ============================================

-- 1. TEAM CONFIG: plazo de votación MVP en horas (24h por defecto)
ALTER TABLE team_config
  ADD COLUMN IF NOT EXISTS mvp_vote_deadline_hours INTEGER NOT NULL DEFAULT 24;

-- 2. MATCHES: marcador del partido
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_score INTEGER;
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS away_score INTEGER;

-- 3. TRIGGER de voto: ahora también bloquea cuando se venció el plazo de votación
CREATE OR REPLACE FUNCTION check_mvp_vote()
RETURNS TRIGGER AS $$
DECLARE
  vote_count INT;
  match_status TEXT;
  match_date DATE;
  match_time TIME;
  deadline TIMESTAMPTZ;
  hours INT;
  voter_confirmed BOOLEAN;
  voted_confirmed BOOLEAN;
BEGIN
  SELECT status, date, time INTO match_status, match_date, match_time
  FROM matches WHERE id = NEW.match_id;

  IF match_status IS DISTINCT FROM 'played' THEN
    RAISE EXCEPTION 'Solo se puede votar en partidos jugados';
  END IF;

  SELECT mvp_vote_deadline_hours INTO hours FROM team_config LIMIT 1;
  deadline := (match_date::timestamp + match_time) + make_interval(hours => COALESCE(hours, 24));
  IF NOW() > deadline THEN
    RAISE EXCEPTION 'La votación de este partido ya cerró';
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

-- 4. Tabla general anual: solo cuenta partidos cuya votación ya cerró
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
  WITH cfg AS (
    SELECT mvp_points_first, mvp_points_second, mvp_vote_deadline_hours FROM team_config LIMIT 1
  ),
  match_ranks AS (
    SELECT
      mv.match_id,
      mv.voted_id,
      COUNT(*) AS votes,
      ROW_NUMBER() OVER (PARTITION BY mv.match_id ORDER BY COUNT(*) DESC, mv.voted_id) AS rn
    FROM mvp_votes mv
    JOIN matches m ON m.id = mv.match_id
    CROSS JOIN cfg
    WHERE EXTRACT(YEAR FROM m.date) = target_year
      AND (m.date::timestamp + m.time + make_interval(hours => COALESCE(cfg.mvp_vote_deadline_hours, 24))) < NOW()
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
