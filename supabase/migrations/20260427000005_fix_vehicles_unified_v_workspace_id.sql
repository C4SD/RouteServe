-- Add workspace_id to vehicles_unified_v (was missing from original SELECT list)
-- CREATE OR REPLACE cannot insert a column mid-list; must drop and recreate
DROP VIEW IF EXISTS vehicles_unified_v;
CREATE VIEW vehicles_unified_v AS
SELECT
  v.id,
  v.workspace_id,
  v.category_id,
  v.vehicle_type_id,
  v.fleet_id,

  -- Basic Info
  v.make,
  v.model,
  v.year,
  v.license_plate,
  v.plate_number,
  v.vin,

  -- Physical Dimensions
  v.length_cm,
  v.width_cm,
  v.height_cm,

  -- Capacity Fields
  v.capacity,
  v.capacity_kg,
  v.capacity_m3,
  v.capacity_weight_kg,
  v.capacity_volume_m3,
  v.max_weight,
  v.gross_vehicle_weight_kg,

  -- Configuration
  v.tiered_config,

  -- Telematics
  v.telematics_provider,
  v.telematics_id,

  -- Technical Specs
  v.number_of_axles,
  v.number_of_wheels,
  v.fuel_type,
  v.fuel_efficiency,
  v.avg_speed,
  v.engine_capacity,
  v.transmission,
  v.seating_capacity,

  -- Acquisition & Financials
  v.acquisition_mode,
  v.acquisition_type,
  v.acquisition_date,
  v.date_acquired,
  v.purchase_price,
  v.current_book_value,
  v.depreciation_rate,

  -- Insurance & Registration
  v.insurance_expiry,
  v.insurance_policy_number,
  v.insurance_provider,
  v.registration_expiry,

  -- Maintenance
  v.last_service_date,
  v.next_service_date,
  v.last_inspection_date,
  v.next_inspection_date,
  v.total_maintenance_cost,
  v.warranty_expiry,

  -- Current State
  v.status,
  v.current_driver_id,
  v.current_location_id,
  v.current_mileage,

  -- Metadata
  v.color,
  v.notes,
  v.tags,
  v.photos,
  v.photo_url,
  v.thumbnail_url,
  v.photo_uploaded_at,
  v.ai_capacity_image_url,
  v.ai_generated,
  v.documents,

  -- Legacy Metadata
  v.legacy_metadata,

  -- Audit Fields
  v.created_at,
  v.created_by,
  v.updated_at,
  v.updated_by

FROM vehicles v;

GRANT SELECT ON vehicles_unified_v TO authenticated;
