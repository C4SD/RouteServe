-- =====================================================
-- VLMS (Vehicle Lifecycle Management System) Schema
-- =====================================================
-- Version: 1.0
-- Created: 2024-11-13
-- Description: Complete database schema for vehicle lifecycle management
-- including vehicles, maintenance, fuel logs, assignments, incidents,
-- inspections, and disposal records.
-- =====================================================

-- =====================================================
-- SEQUENCES for Auto-generated IDs
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS vehicle_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS maintenance_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS assignment_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS incident_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS inspection_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS disposal_id_seq START 1;

-- =====================================================
-- TABLE 1: vlms_vehicles
-- =====================================================

CREATE TABLE vlms_vehicles (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id VARCHAR(50) UNIQUE NOT NULL,

  -- Basic Info
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2200),
  vin VARCHAR(17) UNIQUE,
  license_plate VARCHAR(20) UNIQUE NOT NULL,

  -- Classification
  vehicle_type VARCHAR(50) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL,
  transmission VARCHAR(50),

  -- Specifications
  engine_capacity DECIMAL(10, 2),
  color VARCHAR(50),
  seating_capacity INTEGER,
  cargo_capacity DECIMAL(10, 2),

  -- Acquisition
  acquisition_date DATE NOT NULL,
  acquisition_type VARCHAR(50) NOT NULL,
  purchase_price DECIMAL(15, 2),
  vendor_name VARCHAR(255),
  warranty_expiry DATE,

  -- Current Status
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  current_location_id UUID REFERENCES facilities(id),
  current_driver_id UUID REFERENCES profiles(id),
  current_assignment_type VARCHAR(50),

  -- Operational Metrics
  current_mileage DECIMAL(10, 2) DEFAULT 0,
  last_service_date DATE,
  next_service_date DATE,
  last_inspection_date DATE,
  next_inspection_date DATE,

  -- Insurance & Registration
  insurance_provider VARCHAR(255),
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  registration_expiry DATE,

  -- Financial
  depreciation_rate DECIMAL(5, 2),
  current_book_value DECIMAL(15, 2),
  total_maintenance_cost DECIMAL(15, 2) DEFAULT 0,

  -- Documents & Photos
  documents JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_vehicles
CREATE INDEX idx_vlms_vehicles_status ON vlms_vehicles(status);
CREATE INDEX idx_vlms_vehicles_type ON vlms_vehicles(vehicle_type);
CREATE INDEX idx_vlms_vehicles_location ON vlms_vehicles(current_location_id);
CREATE INDEX idx_vlms_vehicles_driver ON vlms_vehicles(current_driver_id);
CREATE INDEX idx_vlms_vehicles_license ON vlms_vehicles(license_plate);
CREATE INDEX idx_vlms_vehicles_next_service ON vlms_vehicles(next_service_date) WHERE status != 'disposed';
CREATE INDEX idx_vlms_vehicles_tags ON vlms_vehicles USING gin(tags);

-- Comments
COMMENT ON TABLE vlms_vehicles IS 'Primary vehicle registry with comprehensive tracking';
COMMENT ON COLUMN vlms_vehicles.vehicle_id IS 'Auto-generated ID in format VEH-YYYY-NNN';
COMMENT ON COLUMN vlms_vehicles.status IS 'Vehicle status: available, in_use, maintenance, out_of_service, disposed';
COMMENT ON COLUMN vlms_vehicles.documents IS 'Array of {name, url, type, uploaded_at}';
COMMENT ON COLUMN vlms_vehicles.photos IS 'Array of {url, caption, uploaded_at}';

-- =====================================================
-- TABLE 2: vlms_maintenance_records
-- =====================================================

CREATE TABLE vlms_maintenance_records (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_date DATE,
  actual_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',

  -- Classification
  maintenance_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal',

  -- Service Details
  service_provider VARCHAR(255),
  service_location VARCHAR(255),
  technician_name VARCHAR(255),
  work_order_number VARCHAR(100),

  -- Metrics
  mileage_at_service DECIMAL(10, 2),
  labor_hours DECIMAL(6, 2),

  -- Costs
  labor_cost DECIMAL(12, 2) DEFAULT 0,
  parts_cost DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,

  -- Details
  description TEXT NOT NULL,
  parts_replaced JSONB DEFAULT '[]'::jsonb,
  issues_found TEXT,
  recommendations TEXT,

  -- Follow-up
  next_service_date DATE,
  next_service_mileage DECIMAL(10, 2),
  warranty_until DATE,

  -- Documents
  invoices JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  completed_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_maintenance_records
CREATE INDEX idx_vlms_maintenance_vehicle ON vlms_maintenance_records(vehicle_id);
CREATE INDEX idx_vlms_maintenance_status ON vlms_maintenance_records(status);
CREATE INDEX idx_vlms_maintenance_type ON vlms_maintenance_records(maintenance_type);
CREATE INDEX idx_vlms_maintenance_scheduled ON vlms_maintenance_records(scheduled_date) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_vlms_maintenance_actual_date ON vlms_maintenance_records(actual_date);

-- Comments
COMMENT ON TABLE vlms_maintenance_records IS 'Comprehensive maintenance and repair tracking';
COMMENT ON COLUMN vlms_maintenance_records.record_id IS 'Auto-generated ID in format MNT-YYYY-NNN';
COMMENT ON COLUMN vlms_maintenance_records.status IS 'Status: scheduled, in_progress, completed, cancelled';
COMMENT ON COLUMN vlms_maintenance_records.maintenance_type IS 'Type: routine, repair, inspection, emergency, recall';
COMMENT ON COLUMN vlms_maintenance_records.parts_replaced IS 'Array of {part_name, part_number, quantity, cost}';

-- =====================================================
-- TABLE 3: vlms_fuel_logs
-- =====================================================

CREATE TABLE vlms_fuel_logs (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- Transaction Details
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_number VARCHAR(100),

  -- Location
  station_name VARCHAR(255),
  station_location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Fuel Details
  fuel_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- Vehicle State
  odometer_reading DECIMAL(10, 2) NOT NULL,
  trip_distance DECIMAL(10, 2),
  fuel_efficiency DECIMAL(8, 2),

  -- Payment
  payment_method VARCHAR(50),
  fuel_card_number VARCHAR(50),
  receipt_number VARCHAR(100),

  -- Personnel
  driver_id UUID REFERENCES profiles(id),
  driver_name VARCHAR(255),

  -- Documents
  receipt_url TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_fuel_logs
CREATE INDEX idx_vlms_fuel_vehicle ON vlms_fuel_logs(vehicle_id);
CREATE INDEX idx_vlms_fuel_date ON vlms_fuel_logs(transaction_date);
CREATE INDEX idx_vlms_fuel_driver ON vlms_fuel_logs(driver_id);

-- Comments
COMMENT ON TABLE vlms_fuel_logs IS 'Track fuel consumption and efficiency';
COMMENT ON COLUMN vlms_fuel_logs.fuel_efficiency IS 'km/L or kWh/100km';

-- =====================================================
-- TABLE 4: vlms_assignments
-- =====================================================

CREATE TABLE vlms_assignments (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- Assignment Details
  assigned_to_id UUID REFERENCES profiles(id),
  assigned_location_id UUID REFERENCES facilities(id),
  assignment_type VARCHAR(50) NOT NULL,

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  actual_return_date DATE,

  -- Purpose
  purpose TEXT NOT NULL,
  project_name VARCHAR(255),
  authorization_number VARCHAR(100),
  authorized_by_id UUID REFERENCES profiles(id),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',

  -- Handover Details
  odometer_start DECIMAL(10, 2),
  odometer_end DECIMAL(10, 2),
  fuel_level_start DECIMAL(5, 2),
  fuel_level_end DECIMAL(5, 2),
  condition_start TEXT,
  condition_end TEXT,

  -- Documents
  assignment_letter_url TEXT,
  return_checklist_url TEXT,
  photos_start JSONB DEFAULT '[]'::jsonb,
  photos_end JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_assignments
CREATE INDEX idx_vlms_assignments_vehicle ON vlms_assignments(vehicle_id);
CREATE INDEX idx_vlms_assignments_driver ON vlms_assignments(assigned_to_id);
CREATE INDEX idx_vlms_assignments_location ON vlms_assignments(assigned_location_id);
CREATE INDEX idx_vlms_assignments_status ON vlms_assignments(status);
CREATE INDEX idx_vlms_assignments_active ON vlms_assignments(start_date, end_date) WHERE status = 'active';

-- Comments
COMMENT ON TABLE vlms_assignments IS 'Track vehicle assignments to drivers and locations';
COMMENT ON COLUMN vlms_assignments.assignment_id IS 'Auto-generated ID in format ASN-YYYY-NNN';
COMMENT ON COLUMN vlms_assignments.status IS 'Status: active, completed, cancelled, overdue';
COMMENT ON COLUMN vlms_assignments.assignment_type IS 'Type: permanent, temporary, pool, project';

-- =====================================================
-- TABLE 5: vlms_incidents
-- =====================================================

CREATE TABLE vlms_incidents (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- When & Where
  incident_date TIMESTAMPTZ NOT NULL,
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Classification
  incident_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,

  -- People Involved
  driver_id UUID REFERENCES profiles(id),
  driver_name VARCHAR(255) NOT NULL,
  passengers TEXT,
  other_parties TEXT,

  -- Vehicle State
  odometer_reading DECIMAL(10, 2),
  vehicle_condition_before TEXT,

  -- Description
  description TEXT NOT NULL,
  cause TEXT,
  damages_description TEXT,

  -- Official Reports
  police_report_number VARCHAR(100),
  police_station VARCHAR(255),
  insurance_claim_number VARCHAR(100),
  claim_status VARCHAR(50),

  -- Financial Impact
  estimated_repair_cost DECIMAL(15, 2),
  actual_repair_cost DECIMAL(15, 2),
  insurance_payout DECIMAL(15, 2),
  deductible_amount DECIMAL(15, 2),

  -- Follow-up
  action_taken TEXT,
  preventive_measures TEXT,
  responsible_party VARCHAR(255),

  -- Documents & Evidence
  police_report_url TEXT,
  insurance_documents JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  witness_statements JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'reported',
  resolved_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_incidents
CREATE INDEX idx_vlms_incidents_vehicle ON vlms_incidents(vehicle_id);
CREATE INDEX idx_vlms_incidents_driver ON vlms_incidents(driver_id);
CREATE INDEX idx_vlms_incidents_date ON vlms_incidents(incident_date);
CREATE INDEX idx_vlms_incidents_type ON vlms_incidents(incident_type);
CREATE INDEX idx_vlms_incidents_status ON vlms_incidents(status);

-- Comments
COMMENT ON TABLE vlms_incidents IS 'Track accidents, damage, and incidents';
COMMENT ON COLUMN vlms_incidents.incident_id IS 'Auto-generated ID in format INC-YYYY-NNN';
COMMENT ON COLUMN vlms_incidents.incident_type IS 'Type: accident, theft, vandalism, breakdown, damage';
COMMENT ON COLUMN vlms_incidents.severity IS 'Severity: minor, moderate, major, total_loss';
COMMENT ON COLUMN vlms_incidents.status IS 'Status: reported, investigating, resolved, closed';

-- =====================================================
-- TABLE 6: vlms_inspections
-- =====================================================

CREATE TABLE vlms_inspections (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- Scheduling
  inspection_date DATE NOT NULL,
  inspection_type VARCHAR(50) NOT NULL,

  -- Inspector
  inspector_id UUID REFERENCES profiles(id),
  inspector_name VARCHAR(255) NOT NULL,
  inspector_certification VARCHAR(100),

  -- Vehicle State
  odometer_reading DECIMAL(10, 2),

  -- Inspection Results
  overall_status VARCHAR(20) NOT NULL,
  checklist JSONB NOT NULL,

  -- Categories Checked
  exterior_condition JSONB,
  interior_condition JSONB,
  engine_mechanical JSONB,
  electrical_system JSONB,
  brakes JSONB,
  tires JSONB,
  lights_signals JSONB,
  safety_equipment JSONB,
  fluid_levels JSONB,

  -- Issues Found
  defects_found TEXT[],
  priority_repairs TEXT[],
  recommendations TEXT,

  -- Follow-up
  next_inspection_date DATE,
  reinspection_required BOOLEAN DEFAULT false,
  reinspection_date DATE,

  -- Compliance
  meets_safety_standards BOOLEAN NOT NULL,
  roadworthy BOOLEAN NOT NULL,
  compliance_notes TEXT,

  -- Documents
  inspection_report_url TEXT,
  photos JSONB DEFAULT '[]'::jsonb,

  -- Certification
  certificate_number VARCHAR(100),
  certificate_issued_date DATE,
  certificate_expiry_date DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_inspections
CREATE INDEX idx_vlms_inspections_vehicle ON vlms_inspections(vehicle_id);
CREATE INDEX idx_vlms_inspections_date ON vlms_inspections(inspection_date);
CREATE INDEX idx_vlms_inspections_status ON vlms_inspections(overall_status);
CREATE INDEX idx_vlms_inspections_next ON vlms_inspections(next_inspection_date) WHERE overall_status = 'pass';

-- Comments
COMMENT ON TABLE vlms_inspections IS 'Regular vehicle inspections and safety checks';
COMMENT ON COLUMN vlms_inspections.inspection_id IS 'Auto-generated ID in format INS-YYYY-NNN';
COMMENT ON COLUMN vlms_inspections.inspection_type IS 'Type: routine, annual, pre_trip, post_trip, safety';
COMMENT ON COLUMN vlms_inspections.overall_status IS 'Status: pass, fail, conditional';
COMMENT ON COLUMN vlms_inspections.checklist IS 'Array of {item, category, status, notes}';

-- =====================================================
-- TABLE 7: vlms_disposal_records
-- =====================================================

CREATE TABLE vlms_disposal_records (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disposal_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vlms_vehicles(id) ON DELETE CASCADE,

  -- Disposal Details
  disposal_date DATE NOT NULL,
  disposal_method VARCHAR(50) NOT NULL,
  disposal_reason TEXT NOT NULL,

  -- Financial
  final_book_value DECIMAL(15, 2),
  disposal_value DECIMAL(15, 2),
  gain_loss DECIMAL(15, 2) GENERATED ALWAYS AS (disposal_value - final_book_value) STORED,

  -- Buyer/Recipient Details
  buyer_name VARCHAR(255),
  buyer_contact VARCHAR(255),
  buyer_address TEXT,

  -- Vehicle Final State
  final_mileage DECIMAL(10, 2),
  final_condition TEXT,
  total_lifecycle_cost DECIMAL(15, 2),

  -- Documentation
  disposal_authorization_number VARCHAR(100),
  authorized_by_id UUID REFERENCES profiles(id),
  bill_of_sale_url TEXT,
  release_documents JSONB DEFAULT '[]'::jsonb,
  final_photos JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for vlms_disposal_records
CREATE INDEX idx_vlms_disposal_vehicle ON vlms_disposal_records(vehicle_id);
CREATE INDEX idx_vlms_disposal_date ON vlms_disposal_records(disposal_date);
CREATE INDEX idx_vlms_disposal_method ON vlms_disposal_records(disposal_method);

-- Comments
COMMENT ON TABLE vlms_disposal_records IS 'Track vehicle disposal and end-of-life management';
COMMENT ON COLUMN vlms_disposal_records.disposal_id IS 'Auto-generated ID in format DSP-YYYY-NNN';
COMMENT ON COLUMN vlms_disposal_records.disposal_method IS 'Method: sale, auction, scrap, donation, trade_in';

-- =====================================================
-- FUNCTIONS: Auto-generate IDs
-- =====================================================

-- Function to generate vehicle_id
CREATE OR REPLACE FUNCTION generate_vehicle_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.vehicle_id := 'VEH-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('vehicle_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate maintenance record_id
CREATE OR REPLACE FUNCTION generate_maintenance_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.record_id := 'MNT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('maintenance_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate assignment_id
CREATE OR REPLACE FUNCTION generate_assignment_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.assignment_id := 'ASN-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('assignment_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate incident_id
CREATE OR REPLACE FUNCTION generate_incident_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.incident_id := 'INC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('incident_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate inspection_id
CREATE OR REPLACE FUNCTION generate_inspection_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.inspection_id := 'INS-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('inspection_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate disposal_id
CREATE OR REPLACE FUNCTION generate_disposal_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.disposal_id := 'DSP-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('disposal_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS: Auto-generate IDs
-- =====================================================

CREATE TRIGGER set_vehicle_id
BEFORE INSERT ON vlms_vehicles
FOR EACH ROW
EXECUTE FUNCTION generate_vehicle_id();

CREATE TRIGGER set_maintenance_id
BEFORE INSERT ON vlms_maintenance_records
FOR EACH ROW
EXECUTE FUNCTION generate_maintenance_id();

CREATE TRIGGER set_assignment_id
BEFORE INSERT ON vlms_assignments
FOR EACH ROW
EXECUTE FUNCTION generate_assignment_id();

CREATE TRIGGER set_incident_id
BEFORE INSERT ON vlms_incidents
FOR EACH ROW
EXECUTE FUNCTION generate_incident_id();

CREATE TRIGGER set_inspection_id
BEFORE INSERT ON vlms_inspections
FOR EACH ROW
EXECUTE FUNCTION generate_inspection_id();

CREATE TRIGGER set_disposal_id
BEFORE INSERT ON vlms_disposal_records
FOR EACH ROW
EXECUTE FUNCTION generate_disposal_id();

-- =====================================================
-- TRIGGERS: Updated_at Timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vlms_vehicles_updated_at
BEFORE UPDATE ON vlms_vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vlms_maintenance_updated_at
BEFORE UPDATE ON vlms_maintenance_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vlms_assignments_updated_at
BEFORE UPDATE ON vlms_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vlms_incidents_updated_at
BEFORE UPDATE ON vlms_incidents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE vlms_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlms_disposal_records ENABLE ROW LEVEL SECURITY;

-- Policies for vlms_vehicles
CREATE POLICY "Users can view vehicles"
ON vlms_vehicles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can create vehicles"
ON vlms_vehicles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

CREATE POLICY "Admins and fleet managers can update vehicles"
ON vlms_vehicles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

CREATE POLICY "Admins can delete vehicles"
ON vlms_vehicles FOR DELETE
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
);

-- Policies for vlms_maintenance_records
CREATE POLICY "Users can view maintenance records"
ON vlms_maintenance_records FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can manage maintenance records"
ON vlms_maintenance_records FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

-- Policies for vlms_fuel_logs
CREATE POLICY "Users can view fuel logs"
ON vlms_fuel_logs FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create fuel logs"
ON vlms_fuel_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can manage fuel logs"
ON vlms_fuel_logs FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

-- Policies for vlms_assignments
CREATE POLICY "Users can view assignments"
ON vlms_assignments FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can manage assignments"
ON vlms_assignments FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

-- Policies for vlms_incidents
CREATE POLICY "Users can view incidents"
ON vlms_incidents FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create incidents"
ON vlms_incidents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can manage incidents"
ON vlms_incidents FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

-- Policies for vlms_inspections
CREATE POLICY "Users can view inspections"
ON vlms_inspections FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and fleet managers can manage inspections"
ON vlms_inspections FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_officer'::app_role) OR
  public.has_role(auth.uid(), 'zonal_manager'::app_role)
);

-- Policies for vlms_disposal_records
CREATE POLICY "Users can view disposal records"
ON vlms_disposal_records FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage disposal records"
ON vlms_disposal_records FOR ALL
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
);

-- =====================================================
-- VIEWS: Common Queries
-- =====================================================

-- View: Available vehicles
CREATE OR REPLACE VIEW vlms_available_vehicles AS
SELECT
  v.*,
  COUNT(DISTINCT m.id) as maintenance_count,
  COUNT(DISTINCT a.id) as assignment_count,
  COUNT(DISTINCT i.id) as incident_count
FROM vlms_vehicles v
LEFT JOIN vlms_maintenance_records m ON v.id = m.vehicle_id
LEFT JOIN vlms_assignments a ON v.id = a.vehicle_id
LEFT JOIN vlms_incidents i ON v.id = i.vehicle_id
WHERE v.status = 'available'
GROUP BY v.id;

-- View: Upcoming maintenance
CREATE OR REPLACE VIEW vlms_upcoming_maintenance AS
SELECT
  m.*,
  v.vehicle_id as vehicle_display_id,
  v.make,
  v.model,
  v.license_plate,
  v.current_mileage
FROM vlms_maintenance_records m
JOIN vlms_vehicles v ON m.vehicle_id = v.id
WHERE m.status IN ('scheduled', 'in_progress')
  AND m.scheduled_date >= CURRENT_DATE
ORDER BY m.scheduled_date ASC;

-- View: Overdue maintenance
CREATE OR REPLACE VIEW vlms_overdue_maintenance AS
SELECT
  m.*,
  v.vehicle_id as vehicle_display_id,
  v.make,
  v.model,
  v.license_plate,
  CURRENT_DATE - m.scheduled_date as days_overdue
FROM vlms_maintenance_records m
JOIN vlms_vehicles v ON m.vehicle_id = v.id
WHERE m.status IN ('scheduled', 'in_progress')
  AND m.scheduled_date < CURRENT_DATE
ORDER BY m.scheduled_date ASC;

-- View: Active assignments
CREATE OR REPLACE VIEW vlms_active_assignments AS
SELECT
  a.*,
  v.vehicle_id as vehicle_display_id,
  v.make,
  v.model,
  v.license_plate,
  p.full_name as assigned_to_name,
  f.name as assigned_location_name
FROM vlms_assignments a
JOIN vlms_vehicles v ON a.vehicle_id = v.id
LEFT JOIN profiles p ON a.assigned_to_id = p.id
LEFT JOIN facilities f ON a.assigned_location_id = f.id
WHERE a.status = 'active'
ORDER BY a.start_date DESC;

-- =====================================================
-- FUNCTIONS: Business Logic
-- =====================================================

-- Function: Calculate fuel efficiency for a vehicle
CREATE OR REPLACE FUNCTION calculate_vehicle_fuel_efficiency(
  p_vehicle_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  v_total_distance DECIMAL;
  v_total_fuel DECIMAL;
  v_efficiency DECIMAL;
BEGIN
  SELECT
    SUM(trip_distance),
    SUM(quantity)
  INTO v_total_distance, v_total_fuel
  FROM vlms_fuel_logs
  WHERE vehicle_id = p_vehicle_id
    AND (p_start_date IS NULL OR transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR transaction_date <= p_end_date)
    AND trip_distance IS NOT NULL
    AND trip_distance > 0;

  IF v_total_fuel IS NULL OR v_total_fuel = 0 THEN
    RETURN NULL;
  END IF;

  v_efficiency := v_total_distance / v_total_fuel;
  RETURN v_efficiency;
END;
$$ LANGUAGE plpgsql;

-- Function: Update vehicle maintenance cost
CREATE OR REPLACE FUNCTION update_vehicle_maintenance_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' THEN
      UPDATE vlms_vehicles
      SET total_maintenance_cost = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM vlms_maintenance_records
        WHERE vehicle_id = NEW.vehicle_id
          AND status = 'completed'
      )
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vehicle_maintenance_cost_trigger
AFTER INSERT OR UPDATE ON vlms_maintenance_records
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_maintenance_cost();

-- Function: Update vehicle mileage from fuel log
CREATE OR REPLACE FUNCTION update_vehicle_mileage_from_fuel_log()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vlms_vehicles
  SET current_mileage = GREATEST(current_mileage, NEW.odometer_reading)
  WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vehicle_mileage_trigger
AFTER INSERT ON vlms_fuel_logs
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_mileage_from_fuel_log();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on sequences
GRANT USAGE ON SEQUENCE vehicle_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE maintenance_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE assignment_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE incident_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE inspection_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE disposal_id_seq TO authenticated;

-- Grant permissions on tables
GRANT ALL ON vlms_vehicles TO authenticated;
GRANT ALL ON vlms_maintenance_records TO authenticated;
GRANT ALL ON vlms_fuel_logs TO authenticated;
GRANT ALL ON vlms_assignments TO authenticated;
GRANT ALL ON vlms_incidents TO authenticated;
GRANT ALL ON vlms_inspections TO authenticated;
GRANT ALL ON vlms_disposal_records TO authenticated;

-- Grant permissions on views
GRANT SELECT ON vlms_available_vehicles TO authenticated;
GRANT SELECT ON vlms_upcoming_maintenance TO authenticated;
GRANT SELECT ON vlms_overdue_maintenance TO authenticated;
GRANT SELECT ON vlms_active_assignments TO authenticated;
