-- ============================================
-- Fútbol Sin Nivel (FSN) - Esquema completo
-- ============================================

-- 1. PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  avatar_url TEXT,
  position TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ROLES
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO roles (name) VALUES ('super_admin'), ('admin'), ('jugador');

-- 3. PROFILE ROLES
CREATE TABLE profile_roles (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, role_id)
);

-- 4. TEAM CONFIG
CREATE TABLE team_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL DEFAULT 'Fútbol Sin Nivel',
  team_siglas TEXT NOT NULL DEFAULT 'FSN',
  default_cost NUMERIC(10,0) NOT NULL DEFAULT 180000,
  default_time TIME NOT NULL DEFAULT '20:00',
  default_location TEXT,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_day_of_week INTEGER NOT NULL DEFAULT 1,
  fine_percentage NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO team_config (team_name, team_siglas) VALUES ('Fútbol Sin Nivel', 'FSN');

-- 5. SEASONS
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. MATCHES
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL DEFAULT '20:00',
  location TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  cost NUMERIC(10,0) NOT NULL DEFAULT 180000,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'played', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ATTENDANCE
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'declined', 'no_show')),
  fined BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, profile_id)
);

-- 8. GOALS
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  scorer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. PAYMENTS
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  receipt_url TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, profile_id)
);

-- 10. PHOTOS
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. MVP VOTES
CREATE TABLE mvp_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  voted_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, voter_id)
);

-- 12. FINES
CREATE TABLE fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,0) NOT NULL,
  reason TEXT,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. EXPENSES
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,0) NOT NULL,
  paid_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FUNCIONES DE AYUDA (bypass RLS)
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles pr
    JOIN roles r ON r.id = pr.role_id
    WHERE pr.profile_id = user_id AND r.name IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles pr
    JOIN roles r ON r.id = pr.role_id
    WHERE pr.profile_id = user_id AND r.name = 'super_admin'
  );
$$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles: everyone can read, user can update own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Profile roles: everyone can read, only super_admin can insert/delete
CREATE POLICY "Profile roles are viewable by authenticated"
  ON profile_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only super_admin can insert profile_roles"
  ON profile_roles FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Only super_admin can delete profile_roles"
  ON profile_roles FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- Matches: viewable by all, admin/super_admin can insert/update/delete
CREATE POLICY "Matches are viewable by authenticated"
  ON matches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert matches"
  ON matches FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update matches"
  ON matches FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete matches"
  ON matches FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Attendance: viewable by all, user can manage own, admins can manage all
CREATE POLICY "Attendance is viewable by authenticated"
  ON attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own attendance"
  ON attendance FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own attendance"
  ON attendance FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage all attendance"
  ON attendance FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Goals: viewable by all, insertable by admins and the scorer
CREATE POLICY "Goals are viewable by authenticated"
  ON goals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert goals"
  ON goals FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR scorer_id = auth.uid());

-- Payments: viewable by all, user can manage own, admins can approve
CREATE POLICY "Payments are viewable by authenticated"
  ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own payment"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own pending payment"
  ON payments FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can update any payment"
  ON payments FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- Photos: viewable by all, admins can insert
CREATE POLICY "Photos are viewable by authenticated"
  ON photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert photos"
  ON photos FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- MVP votes: viewable by all, user can vote once per match
CREATE POLICY "MVP votes are viewable by authenticated"
  ON mvp_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can vote"
  ON mvp_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

-- Fines: viewable by all, admins can manage
CREATE POLICY "Fines are viewable by authenticated"
  ON fines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert fines"
  ON fines FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update fines"
  ON fines FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- Expenses: viewable by all, admins can manage
CREATE POLICY "Expenses are viewable by authenticated"
  ON expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert expenses"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, nickname)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'nickname'
  );

  INSERT INTO public.profile_roles (profile_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'jugador';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- AUTO-CREATE MONTHLY MATCHES (call via cron)
-- ============================================
CREATE OR REPLACE FUNCTION generate_monthly_matches(target_year INT DEFAULT NULL, target_month INT DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  year INT := COALESCE(target_year, EXTRACT(YEAR FROM CURRENT_DATE));
  month INT := COALESCE(target_month, EXTRACT(MONTH FROM CURRENT_DATE));
  match_date DATE;
  config RECORD;
  created_count INT := 0;
BEGIN
  SELECT * INTO config FROM team_config LIMIT 1;

  match_date := date_trunc('month', make_date(year, month, 1))::DATE;

  WHILE EXTRACT(DOW FROM match_date) != config.default_day_of_week LOOP
    match_date := match_date + 1;
  END LOOP;

  WHILE EXTRACT(MONTH FROM match_date) = month LOOP
    IF NOT EXISTS (SELECT 1 FROM matches WHERE date = match_date) THEN
      INSERT INTO matches (date, time, location, duration_minutes, cost)
      VALUES (
        match_date,
        config.default_time,
        config.default_location,
        config.default_duration_minutes,
        config.default_cost
      );
      created_count := created_count + 1;
    END IF;

    match_date := match_date + 7;
  END LOOP;

  RETURN created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_matches_date ON matches(date DESC);
CREATE INDEX idx_attendance_match ON attendance(match_id);
CREATE INDEX idx_attendance_profile ON attendance(profile_id);
CREATE INDEX idx_goals_match ON goals(match_id);
CREATE INDEX idx_goals_scorer ON goals(scorer_id);
CREATE INDEX idx_payments_match ON payments(match_id);
CREATE INDEX idx_payments_profile ON payments(profile_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_photos_match ON photos(match_id);
CREATE INDEX idx_mvp_votes_match ON mvp_votes(match_id);
CREATE INDEX idx_fines_profile ON fines(profile_id);
CREATE INDEX idx_expenses_match ON expenses(match_id);
