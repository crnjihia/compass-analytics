-- ==============================================================================
-- PostgreSQL Role & Multi-Tenant Security Initialization
-- Non-superuser application role: NOBYPASSRLS ensures Row-Level Security
-- is strictly enforced for every query and transaction executed by this user.
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'compass_app') THEN
    CREATE ROLE compass_app WITH LOGIN PASSWORD 'compass_secret' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE compass_app WITH NOBYPASSRLS NOSUPERUSER;
  END IF;
END
$$;

-- Grant standard permissions to compass_app on compass_analytics database
GRANT ALL PRIVILEGES ON DATABASE compass_analytics TO compass_app;
GRANT ALL ON SCHEMA public TO compass_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO compass_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO compass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO compass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO compass_app;
