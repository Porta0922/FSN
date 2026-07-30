INSERT INTO profile_roles (profile_id, role_id)
SELECT '06ac5e61-9df3-401f-ae3a-351347fd6c49', id FROM roles WHERE name = 'super_admin';