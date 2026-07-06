-- Add projections config JSONB column to properties table
alter table properties add column if not exists projections_config jsonb default '{}'::jsonb;
