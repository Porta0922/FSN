-- ============================================
-- FSN - Encuentros dentro de un partido (7v7, 10 min)
-- ============================================

-- 1. ENCUENTROS: mini partidos dentro de una sesión de juego
CREATE TABLE IF NOT EXISTS match_encuentros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  team_home_goals INTEGER NOT NULL DEFAULT 0,
  team_away_goals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, index)
);

-- 2. JUGADORES POR ENCUENTRO: equipo (home/away) y goles de cada jugador
CREATE TABLE IF NOT EXISTS match_encuentro_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encuentro_id UUID NOT NULL REFERENCES match_encuentros(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('home', 'away')),
  goals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (encuentro_id, profile_id)
);

-- 3. RLS
ALTER TABLE match_encuentros ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_encuentro_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Encuentros are viewable by authenticated"
  ON match_encuentros FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert encuentros"
  ON match_encuentros FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update encuentros"
  ON match_encuentros FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete encuentros"
  ON match_encuentros FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Encuentro players are viewable by authenticated"
  ON match_encuentro_players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert encuentro players"
  ON match_encuentro_players FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update encuentro players"
  ON match_encuentro_players FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete encuentro players"
  ON match_encuentro_players FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 4. Estadísticas mensuales: ahora suma los goles cargados por encuentro
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
  WITH classic_goals AS (
    SELECT g.scorer_id AS pid, COUNT(*) AS cnt
    FROM goals g
    JOIN matches m ON m.id = g.match_id
    WHERE EXTRACT(YEAR FROM m.date) = target_year
      AND EXTRACT(MONTH FROM m.date) = target_month
    GROUP BY g.scorer_id
  ),
  classic_assists AS (
    SELECT g.assist_id AS pid, COUNT(*) AS cnt
    FROM goals g
    JOIN matches m ON m.id = g.match_id
    WHERE g.assist_id IS NOT NULL
      AND EXTRACT(YEAR FROM m.date) = target_year
      AND EXTRACT(MONTH FROM m.date) = target_month
    GROUP BY g.assist_id
  ),
  encuentro_goals AS (
    SELECT ep.profile_id AS pid, SUM(ep.goals)::BIGINT AS cnt
    FROM match_encuentro_players ep
    JOIN match_encuentros me ON me.id = ep.encuentro_id
    JOIN matches m ON m.id = me.match_id
    WHERE EXTRACT(YEAR FROM m.date) = target_year
      AND EXTRACT(MONTH FROM m.date) = target_month
    GROUP BY ep.profile_id
  ),
  match_counts AS (
    SELECT a.profile_id AS pid, COUNT(DISTINCT a.match_id) AS cnt
    FROM attendance a
    JOIN matches m ON m.id = a.match_id
    WHERE a.status = 'confirmed'
      AND m.status = 'played'
      AND EXTRACT(YEAR FROM m.date) = target_year
      AND EXTRACT(MONTH FROM m.date) = target_month
    GROUP BY a.profile_id
  )
  SELECT
    p.id,
    p.name,
    p.nickname,
    (COALESCE(cg.cnt, 0) + COALESCE(eg.cnt, 0))::BIGINT,
    COALESCE(ca.cnt, 0)::BIGINT,
    COALESCE(mc.cnt, 0)::BIGINT
  FROM profiles p
  LEFT JOIN classic_goals cg ON cg.pid = p.id
  LEFT JOIN classic_assists ca ON ca.pid = p.id
  LEFT JOIN encuentro_goals eg ON eg.pid = p.id
  LEFT JOIN match_counts mc ON mc.pid = p.id
  WHERE p.is_active = true
  ORDER BY (COALESCE(cg.cnt, 0) + COALESCE(eg.cnt, 0)) DESC;
$$;
