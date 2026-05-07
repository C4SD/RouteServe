-- Import session tracking: one row per upload action, one log entry per imported row.
-- Enables the Import Audit page where users can review, retry, and resolve conflicts.

CREATE TABLE public.import_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('facility', 'item', 'program_item')),
  source_file   TEXT,
  status        TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'partial', 'failed')),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  inserted      INTEGER NOT NULL DEFAULT 0,
  updated       INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX import_sessions_workspace_created ON public.import_sessions (workspace_id, created_at DESC);
CREATE INDEX import_sessions_entity_type ON public.import_sessions (entity_type, workspace_id);

-- outcome values:
--   inserted         - new record, successfully created
--   updated          - existed in DB, user confirmed update, succeeded
--   skipped_duplicate - existed in DB, all fields identical, auto-skipped
--   skipped_by_user  - existed in DB with differences, user unchecked it
--   conflict_pending - existed with conflicts, user deferred; resolvable from audit page
--   error            - insert/update failed (DB error or validation)
CREATE TABLE public.import_log_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  row_number       INTEGER NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN (
                     'inserted', 'updated', 'skipped_duplicate',
                     'skipped_by_user', 'conflict_pending', 'error'
                   )),
  entity_id        UUID,
  match_confidence TEXT CHECK (match_confidence IN ('exact_key', 'fuzzy_name')),
  record_name      TEXT,
  raw_data         JSONB,
  field_diffs      JSONB,
  error_message    TEXT,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX import_log_entries_session ON public.import_log_entries (session_id, outcome);
CREATE INDEX import_log_entries_pending ON public.import_log_entries (session_id)
  WHERE outcome = 'conflict_pending' AND resolved_at IS NULL;

-- RLS
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import sessions in their workspace"
  ON public.import_sessions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert import sessions in their workspace"
  ON public.import_sessions FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view import log entries for their sessions"
  ON public.import_log_entries FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM public.import_sessions
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert import log entries for their sessions"
  ON public.import_log_entries FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.import_sessions
      WHERE created_by = auth.uid()
    )
  );

-- Allow updating log entries (for resolving conflict_pending rows)
CREATE POLICY "Users can update import log entries for their sessions"
  ON public.import_log_entries FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM public.import_sessions
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );
