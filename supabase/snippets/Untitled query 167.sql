INSERT INTO profile_roles (profile_id, role_id)
SELECT p.id, r.id FROM profiles p, roles r
WHERE r.name = 'super_admin';