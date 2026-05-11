-- Fix: dispatch_runs and batch_invoice_links RLS policies used an inline
-- workspace_members subquery instead of the canonical is_workspace_member_v2().

DROP POLICY IF EXISTS dispatch_runs_workspace_isolation ON dispatch_runs;
CREATE POLICY dispatch_runs_workspace_isolation ON dispatch_runs
  FOR ALL USING (public.is_workspace_member_v2(workspace_id));

DROP POLICY IF EXISTS batch_invoice_links_workspace_isolation ON batch_invoice_links;
CREATE POLICY batch_invoice_links_workspace_isolation ON batch_invoice_links
  FOR ALL USING (public.is_workspace_member_v2(workspace_id));
