
-- Add time-based workflow triggers
ALTER TYPE public.workflow_trigger ADD VALUE IF NOT EXISTS 'task.due_soon';
ALTER TYPE public.workflow_trigger ADD VALUE IF NOT EXISTS 'contact.stale';
