-- Service Policies: predefined clustering of facilities under a service area
-- Sits between Service Area (eligibility) and Route Engine (sequencing)

-- ─── service_policies ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  service_area_id   UUID NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT,
  clustering_mode   TEXT NOT NULL DEFAULT 'manual'
                      CHECK (clustering_mode IN ('manual', 'lga', 'proximity')),
  constraints       JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'draft', 'archived')),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_policies_workspace   ON service_policies(workspace_id);
CREATE INDEX idx_service_policies_service_area ON service_policies(service_area_id);

-- ─── policy_clusters ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_clusters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_policy_id  UUID NOT NULL REFERENCES service_policies(id) ON DELETE CASCADE,
  code               TEXT NOT NULL,            -- Z1, Z2, …
  name               TEXT,                     -- optional friendly name
  facility_count     INT NOT NULL DEFAULT 0,
  centroid_lat       FLOAT,
  centroid_lng       FLOAT,
  avg_distance_km    FLOAT,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_clusters_policy ON policy_clusters(service_policy_id);
CREATE UNIQUE INDEX idx_policy_clusters_code ON policy_clusters(service_policy_id, code);

-- ─── policy_cluster_facilities ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_cluster_facilities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id  UUID NOT NULL REFERENCES policy_clusters(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, facility_id)
);

CREATE INDEX idx_pcf_cluster  ON policy_cluster_facilities(cluster_id);
CREATE INDEX idx_pcf_facility ON policy_cluster_facilities(facility_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE service_policies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_clusters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_cluster_facilities ENABLE ROW LEVEL SECURITY;

-- service_policies: workspace-scoped read; authenticated write
CREATE POLICY "service_policies_select" ON service_policies
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_policies_insert" ON service_policies
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_policies_update" ON service_policies
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_policies_delete" ON service_policies
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- policy_clusters: accessible via parent service_policy
CREATE POLICY "policy_clusters_select" ON policy_clusters
  FOR SELECT USING (
    service_policy_id IN (
      SELECT id FROM service_policies
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "policy_clusters_insert" ON policy_clusters
  FOR INSERT WITH CHECK (
    service_policy_id IN (
      SELECT id FROM service_policies
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "policy_clusters_update" ON policy_clusters
  FOR UPDATE USING (
    service_policy_id IN (
      SELECT id FROM service_policies
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "policy_clusters_delete" ON policy_clusters
  FOR DELETE USING (
    service_policy_id IN (
      SELECT id FROM service_policies
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- policy_cluster_facilities: accessible via parent cluster
CREATE POLICY "pcf_select" ON policy_cluster_facilities
  FOR SELECT USING (
    cluster_id IN (
      SELECT pc.id FROM policy_clusters pc
      JOIN service_policies sp ON sp.id = pc.service_policy_id
      WHERE sp.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "pcf_insert" ON policy_cluster_facilities
  FOR INSERT WITH CHECK (
    cluster_id IN (
      SELECT pc.id FROM policy_clusters pc
      JOIN service_policies sp ON sp.id = pc.service_policy_id
      WHERE sp.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "pcf_delete" ON policy_cluster_facilities
  FOR DELETE USING (
    cluster_id IN (
      SELECT pc.id FROM policy_clusters pc
      JOIN service_policies sp ON sp.id = pc.service_policy_id
      WHERE sp.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_service_policies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_policies_updated_at
  BEFORE UPDATE ON service_policies
  FOR EACH ROW EXECUTE FUNCTION update_service_policies_updated_at();
