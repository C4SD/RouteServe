export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_units: {
        Row: {
          admin_level: number
          area_km2: number | null
          bounds: unknown
          center_point: unknown
          country_id: string
          created_at: string | null
          geometry: unknown
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          name_en: string | null
          name_local: string | null
          osm_id: number | null
          osm_type: string | null
          parent_id: string | null
          population: number | null
          updated_at: string | null
          workspace_id: string
          zone_id: string | null
        }
        Insert: {
          admin_level: number
          area_km2?: number | null
          bounds?: unknown
          center_point?: unknown
          country_id: string
          created_at?: string | null
          geometry?: unknown
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          name_en?: string | null
          name_local?: string | null
          osm_id?: number | null
          osm_type?: string | null
          parent_id?: string | null
          population?: number | null
          updated_at?: string | null
          workspace_id: string
          zone_id?: string | null
        }
        Update: {
          admin_level?: number
          area_km2?: number | null
          bounds?: unknown
          center_point?: unknown
          country_id?: string
          created_at?: string | null
          geometry?: unknown
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          name_en?: string | null
          name_local?: string | null
          osm_id?: number | null
          osm_type?: string | null
          parent_id?: string | null
          population?: number | null
          updated_at?: string | null
          workspace_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_units_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "admin_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["lga_id"]
          },
          {
            foreignKeyName: "admin_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_units_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "admin_units_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_metrics"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "admin_units_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_slot_assignments: {
        Row: {
          batch_id: string
          created_at: string
          facility_id: string
          id: string
          load_kg: number | null
          load_volume_m3: number | null
          sequence_order: number | null
          slot_key: string
          slot_number: number
          status: string
          tier_name: string
          updated_at: string
          vehicle_id: string
          workspace_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          facility_id: string
          id?: string
          load_kg?: number | null
          load_volume_m3?: number | null
          sequence_order?: number | null
          slot_key: string
          slot_number: number
          status?: string
          tier_name: string
          updated_at?: string
          vehicle_id: string
          workspace_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          facility_id?: string
          id?: string
          load_kg?: number | null
          load_volume_m3?: number | null
          sequence_order?: number | null
          slot_key?: string
          slot_number?: number
          status?: string
          tier_name?: string
          updated_at?: string
          vehicle_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_slot_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          bounds: unknown
          capital: string | null
          created_at: string | null
          currency_code: string | null
          id: string
          is_active: boolean | null
          iso_code: string
          iso3_code: string | null
          metadata: Json | null
          name: string
          phone_code: string | null
          updated_at: string | null
        }
        Insert: {
          bounds?: unknown
          capital?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
          iso_code: string
          iso3_code?: string | null
          metadata?: Json | null
          name: string
          phone_code?: string | null
          updated_at?: string | null
        }
        Update: {
          bounds?: unknown
          capital?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
          iso_code?: string
          iso3_code?: string | null
          metadata?: Json | null
          name?: string
          phone_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_batches: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          batch_snapshot: Json | null
          correlation_id: string | null
          created_at: string | null
          current_stop_index: number | null
          dispatch_node_id: string | null
          driver_id: string | null
          driver_status: Database["public"]["Enums"]["driver_status"] | null
          estimated_distance_km: number | null
          estimated_duration: number
          estimated_duration_min: number | null
          execution_metadata: Json | null
          external_route_data: Json | null
          facility_ids: string[]
          id: string
          is_snapshot_locked: boolean | null
          medication_type: string
          name: string
          notes: string | null
          optimized_route: Json
          payload_utilization_pct: number | null
          pre_batch_id: string | null
          priority: Database["public"]["Enums"]["delivery_priority"]
          route_constraints: Json | null
          route_optimization_method: string | null
          scheduled_date: string
          scheduled_time: string
          slot_assignments: Json | null
          snapshot_locked_at: string | null
          status: Database["public"]["Enums"]["batch_status"]
          total_distance: number
          total_quantity: number
          total_slot_demand: number | null
          total_volume: number | null
          total_weight: number | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_total_slots: number | null
          warehouse_id: string
          workspace_id: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          batch_snapshot?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          current_stop_index?: number | null
          dispatch_node_id?: string | null
          driver_id?: string | null
          driver_status?: Database["public"]["Enums"]["driver_status"] | null
          estimated_distance_km?: number | null
          estimated_duration: number
          estimated_duration_min?: number | null
          execution_metadata?: Json | null
          external_route_data?: Json | null
          facility_ids: string[]
          id?: string
          is_snapshot_locked?: boolean | null
          medication_type: string
          name: string
          notes?: string | null
          optimized_route: Json
          payload_utilization_pct?: number | null
          pre_batch_id?: string | null
          priority?: Database["public"]["Enums"]["delivery_priority"]
          route_constraints?: Json | null
          route_optimization_method?: string | null
          scheduled_date: string
          scheduled_time: string
          slot_assignments?: Json | null
          snapshot_locked_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_distance: number
          total_quantity: number
          total_slot_demand?: number | null
          total_volume?: number | null
          total_weight?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_total_slots?: number | null
          warehouse_id: string
          workspace_id: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          batch_snapshot?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          current_stop_index?: number | null
          dispatch_node_id?: string | null
          driver_id?: string | null
          driver_status?: Database["public"]["Enums"]["driver_status"] | null
          estimated_distance_km?: number | null
          estimated_duration?: number
          estimated_duration_min?: number | null
          execution_metadata?: Json | null
          external_route_data?: Json | null
          facility_ids?: string[]
          id?: string
          is_snapshot_locked?: boolean | null
          medication_type?: string
          name?: string
          notes?: string | null
          optimized_route?: Json
          payload_utilization_pct?: number | null
          pre_batch_id?: string | null
          priority?: Database["public"]["Enums"]["delivery_priority"]
          route_constraints?: Json | null
          route_optimization_method?: string | null
          scheduled_date?: string
          scheduled_time?: string
          slot_assignments?: Json | null
          snapshot_locked_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_distance?: number
          total_quantity?: number
          total_slot_demand?: number | null
          total_volume?: number | null
          total_weight?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_total_slots?: number | null
          warehouse_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_batches_dispatch_node_id_fkey"
            columns: ["dispatch_node_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_pre_batch_id_fkey"
            columns: ["pre_batch_id"]
            isOneToOne: false
            referencedRelation: "scheduler_pre_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_logs: {
        Row: {
          actual_qty: number | null
          batch_id: string | null
          correlation_id: string | null
          discrepancy_reason: string | null
          event_type: string
          expected_qty: number | null
          facility_id: string | null
          id: string
          item_id: string | null
          logged_at: string
          logged_by: string | null
          metadata: Json | null
          transfer_id: string | null
          workspace_id: string
        }
        Insert: {
          actual_qty?: number | null
          batch_id?: string | null
          correlation_id?: string | null
          discrepancy_reason?: string | null
          event_type: string
          expected_qty?: number | null
          facility_id?: string | null
          id?: string
          item_id?: string | null
          logged_at?: string
          logged_by?: string | null
          metadata?: Json | null
          transfer_id?: string | null
          workspace_id: string
        }
        Update: {
          actual_qty?: number | null
          batch_id?: string | null
          correlation_id?: string | null
          discrepancy_reason?: string | null
          event_type?: string
          expected_qty?: number | null
          facility_id?: string | null
          id?: string
          item_id?: string | null
          logged_at?: string
          logged_by?: string | null
          metadata?: Json | null
          transfer_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "delivery_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_schedules: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          dispatched_at: string | null
          driver_id: string | null
          facility_ids: string[]
          id: string
          notes: string | null
          optimization_method: string | null
          planned_date: string
          route: Json | null
          status: string | null
          time_window: string | null
          title: string
          total_payload_kg: number | null
          total_volume_m3: number | null
          updated_at: string | null
          vehicle_id: string | null
          warehouse_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          facility_ids?: string[]
          id?: string
          notes?: string | null
          optimization_method?: string | null
          planned_date: string
          route?: Json | null
          status?: string | null
          time_window?: string | null
          title: string
          total_payload_kg?: number | null
          total_volume_m3?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          warehouse_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          facility_ids?: string[]
          id?: string
          notes?: string | null
          optimization_method?: string | null
          planned_date?: string
          route?: Json | null
          status?: string | null
          time_window?: string | null
          title?: string
          total_payload_kg?: number | null
          total_volume_m3?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          available: boolean | null
          created_at: string | null
          date: string
          driver_id: string
          id: string
          reason: string | null
        }
        Insert: {
          available?: boolean | null
          created_at?: string | null
          date: string
          driver_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          available?: boolean | null
          created_at?: string | null
          date?: string
          driver_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_devices: {
        Row: {
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          is_trusted: boolean
          last_seen_at: string
          platform: string | null
          registered_at: string
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          is_trusted?: boolean
          last_seen_at?: string
          platform?: string | null
          registered_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          is_trusted?: boolean
          last_seen_at?: string
          platform?: string | null
          registered_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      driver_events: {
        Row: {
          batch_id: string
          created_at: string
          driver_id: string
          driver_status: Database["public"]["Enums"]["driver_status"]
          event_type: Database["public"]["Enums"]["event_type"]
          flagged_for_review: boolean | null
          id: string
          location: unknown
          metadata: Json | null
          recorded_at: string
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          synced_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          driver_id: string
          driver_status: Database["public"]["Enums"]["driver_status"]
          event_type: Database["public"]["Enums"]["event_type"]
          flagged_for_review?: boolean | null
          id?: string
          location?: unknown
          metadata?: Json | null
          recorded_at: string
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          synced_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          driver_id?: string
          driver_status?: Database["public"]["Enums"]["driver_status"]
          event_type?: Database["public"]["Enums"]["event_type"]
          flagged_for_review?: boolean | null
          id?: string
          location?: unknown
          metadata?: Json | null
          recorded_at?: string
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "driver_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_gps_events: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          batch_id: string | null
          battery_level: number | null
          captured_at: string
          created_at: string | null
          device_id: string
          driver_id: string
          heading: number | null
          id: string
          is_background: boolean | null
          lat: number
          lng: number
          network_type: string | null
          received_at: string | null
          session_id: string
          speed_mps: number | null
          trip_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          batch_id?: string | null
          battery_level?: number | null
          captured_at: string
          created_at?: string | null
          device_id: string
          driver_id: string
          heading?: number | null
          id?: string
          is_background?: boolean | null
          lat: number
          lng: number
          network_type?: string | null
          received_at?: string | null
          session_id: string
          speed_mps?: number | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          batch_id?: string | null
          battery_level?: number | null
          captured_at?: string
          created_at?: string | null
          device_id?: string
          driver_id?: string
          heading?: number | null
          id?: string
          is_background?: boolean | null
          lat?: number
          lng?: number
          network_type?: string | null
          received_at?: string | null
          session_id?: string
          speed_mps?: number | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_gps_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_sessions: {
        Row: {
          access_token_hash: string
          created_at: string
          device_id: string
          device_metadata: Json | null
          driver_id: string
          end_reason: string | null
          ended_at: string | null
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          last_active_at: string
          last_heartbeat_at: string | null
          refresh_token_hash: string
          started_at: string
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          access_token_hash: string
          created_at?: string
          device_id: string
          device_metadata?: Json | null
          driver_id: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_active_at?: string
          last_heartbeat_at?: string | null
          refresh_token_hash: string
          started_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          access_token_hash?: string
          created_at?: string
          device_id?: string
          device_metadata?: Json | null
          driver_id?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_active_at?: string
          last_heartbeat_at?: string | null
          refresh_token_hash?: string
          started_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_sessions_driver_id_profiles_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicle_history: {
        Row: {
          assigned_at: string | null
          created_at: string | null
          driver_id: string
          id: string
          is_current: boolean | null
          notes: string | null
          total_distance: number | null
          total_trips: number | null
          unassigned_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          total_distance?: number | null
          total_trips?: number | null
          unassigned_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          total_distance?: number | null
          total_trips?: number | null
          unassigned_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          date_of_birth: string | null
          documents_complete: boolean | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employer: string | null
          employment_type: string | null
          federal_id: string | null
          group_name: string | null
          id: string
          license_expiry: string | null
          license_number: string | null
          license_state: string | null
          license_type: Database["public"]["Enums"]["license_type"]
          license_verified: boolean | null
          location_updated_at: string | null
          max_hours: number
          middle_name: string | null
          name: string
          on_time_percentage: number | null
          onboarding_completed: boolean | null
          performance_score: number | null
          phone: string
          position: string | null
          postal_code: string | null
          preferred_services: string | null
          profile_photo_url: string | null
          shift_end: string
          shift_start: string
          start_date: string | null
          state_province: string | null
          status: string | null
          total_deliveries: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          documents_complete?: boolean | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer?: string | null
          employment_type?: string | null
          federal_id?: string | null
          group_name?: string | null
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: Database["public"]["Enums"]["license_type"]
          license_verified?: boolean | null
          location_updated_at?: string | null
          max_hours?: number
          middle_name?: string | null
          name: string
          on_time_percentage?: number | null
          onboarding_completed?: boolean | null
          performance_score?: number | null
          phone: string
          position?: string | null
          postal_code?: string | null
          preferred_services?: string | null
          profile_photo_url?: string | null
          shift_end: string
          shift_start: string
          start_date?: string | null
          state_province?: string | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          documents_complete?: boolean | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer?: string | null
          employment_type?: string | null
          federal_id?: string | null
          group_name?: string | null
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: Database["public"]["Enums"]["license_type"]
          license_verified?: boolean | null
          location_updated_at?: string | null
          max_hours?: number
          middle_name?: string | null
          name?: string
          on_time_percentage?: number | null
          onboarding_completed?: boolean | null
          performance_score?: number | null
          phone?: string
          position?: string | null
          postal_code?: string | null
          preferred_services?: string | null
          profile_photo_url?: string | null
          shift_end?: string
          shift_start?: string
          start_date?: string | null
          state_province?: string | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_login_otps: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: []
      }
      facilities: {
        Row: {
          address: string
          admin_unit_id: string | null
          capacity: number | null
          cd4_service: boolean | null
          contact_name_pharmacy: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          designation: string | null
          email: string | null
          funding_source: string | null
          funding_source_id: string | null
          id: string
          implementing_partner_id: string | null
          ip_name: string | null
          lat: number
          level_of_care: string | null
          lga: string | null
          lng: number
          name: string
          operating_hours: string | null
          pcr_service: boolean | null
          phone: string | null
          phone_pharmacy: string | null
          programme: string | null
          programme_category_id: string | null
          service_zone: string | null
          state: string | null
          storage_capacity: number | null
          type: Database["public"]["Enums"]["facility_type"]
          type_of_service: string | null
          updated_at: string | null
          updated_by: string | null
          ward: string | null
          warehouse_code: string | null
          workspace_id: string
          zone_id: string | null
        }
        Insert: {
          address: string
          admin_unit_id?: string | null
          capacity?: number | null
          cd4_service?: boolean | null
          contact_name_pharmacy?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          designation?: string | null
          email?: string | null
          funding_source?: string | null
          funding_source_id?: string | null
          id?: string
          implementing_partner_id?: string | null
          ip_name?: string | null
          lat: number
          level_of_care?: string | null
          lga?: string | null
          lng: number
          name: string
          operating_hours?: string | null
          pcr_service?: boolean | null
          phone?: string | null
          phone_pharmacy?: string | null
          programme?: string | null
          programme_category_id?: string | null
          service_zone?: string | null
          state?: string | null
          storage_capacity?: number | null
          type?: Database["public"]["Enums"]["facility_type"]
          type_of_service?: string | null
          updated_at?: string | null
          updated_by?: string | null
          ward?: string | null
          warehouse_code?: string | null
          workspace_id: string
          zone_id?: string | null
        }
        Update: {
          address?: string
          admin_unit_id?: string | null
          capacity?: number | null
          cd4_service?: boolean | null
          contact_name_pharmacy?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          designation?: string | null
          email?: string | null
          funding_source?: string | null
          funding_source_id?: string | null
          id?: string
          implementing_partner_id?: string | null
          ip_name?: string | null
          lat?: number
          level_of_care?: string | null
          lga?: string | null
          lng?: number
          name?: string
          operating_hours?: string | null
          pcr_service?: boolean | null
          phone?: string | null
          phone_pharmacy?: string | null
          programme?: string | null
          programme_category_id?: string | null
          service_zone?: string | null
          state?: string | null
          storage_capacity?: number | null
          type?: Database["public"]["Enums"]["facility_type"]
          type_of_service?: string | null
          updated_at?: string | null
          updated_by?: string | null
          ward?: string | null
          warehouse_code?: string | null
          workspace_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "admin_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["lga_id"]
          },
          {
            foreignKeyName: "facilities_funding_source_id_fkey"
            columns: ["funding_source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_implementing_partner_id_fkey"
            columns: ["implementing_partner_id"]
            isOneToOne: false
            referencedRelation: "implementing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_programme_category_id_fkey"
            columns: ["programme_category_id"]
            isOneToOne: false
            referencedRelation: "programme_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "facilities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_metrics"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "facilities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_assignments: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          active: boolean
          assignment_type: string | null
          created_at: string | null
          created_by: string | null
          facility_id: string
          id: string
          metadata: Json | null
          priority: number | null
          updated_at: string | null
          workspace_id: string
          zone_configuration_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          active?: boolean
          assignment_type?: string | null
          created_at?: string | null
          created_by?: string | null
          facility_id: string
          id?: string
          metadata?: Json | null
          priority?: number | null
          updated_at?: string | null
          workspace_id: string
          zone_configuration_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          active?: boolean
          assignment_type?: string | null
          created_at?: string | null
          created_by?: string | null
          facility_id?: string
          id?: string
          metadata?: Json | null
          priority?: number | null
          updated_at?: string | null
          workspace_id?: string
          zone_configuration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "facility_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_assignments_zone_configuration_id_fkey"
            columns: ["zone_configuration_id"]
            isOneToOne: false
            referencedRelation: "zone_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_audit_log: {
        Row: {
          action: string
          details: Json | null
          facility_id: string
          id: string
          performed_by: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          facility_id: string
          id?: string
          performed_by?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          facility_id?: string
          id?: string
          performed_by?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_audit_log_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_audit_log_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
        ]
      }
      facility_deliveries: {
        Row: {
          batch_id: string | null
          created_at: string | null
          delivery_date: string
          driver_id: string | null
          facility_id: string
          id: string
          items_delivered: number
          notes: string | null
          product_name: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          delivery_date: string
          driver_id?: string | null
          facility_id: string
          id?: string
          items_delivered?: number
          notes?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          delivery_date?: string
          driver_id?: string | null
          facility_id?: string
          id?: string
          items_delivered?: number
          notes?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_deliveries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_deliveries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
        ]
      }
      facility_services: {
        Row: {
          availability: boolean | null
          created_at: string | null
          facility_id: string
          id: string
          notes: string | null
          service_name: string
          updated_at: string | null
        }
        Insert: {
          availability?: boolean | null
          created_at?: string | null
          facility_id: string
          id?: string
          notes?: string | null
          service_name: string
          updated_at?: string | null
        }
        Update: {
          availability?: boolean | null
          created_at?: string | null
          facility_id?: string
          id?: string
          notes?: string | null
          service_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_services_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_services_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
        ]
      }
      facility_stock: {
        Row: {
          created_at: string | null
          facility_id: string
          id: string
          last_updated: string | null
          product_id: string | null
          product_name: string
          quantity: number
          unit: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          facility_id: string
          id?: string
          last_updated?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          unit?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          facility_id?: string
          id?: string
          last_updated?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_stock_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_stock_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
        ]
      }
      facility_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fleets: {
        Row: {
          created_at: string | null
          id: string
          mission: string | null
          name: string
          parent_fleet_id: string | null
          service_area_id: string | null
          status: string | null
          vendor_id: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mission?: string | null
          name: string
          parent_fleet_id?: string | null
          service_area_id?: string | null
          status?: string | null
          vendor_id?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mission?: string | null
          name?: string
          parent_fleet_id?: string | null
          service_area_id?: string | null
          status?: string | null
          vendor_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleets_parent_fleet_id_fkey"
            columns: ["parent_fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleets_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleets_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      forensics_query_log: {
        Row: {
          created_at: string | null
          execution_time_ms: number | null
          filters: Json | null
          id: string
          metadata: Json | null
          query_type: string
          results_count: number | null
          time_range_end: string | null
          time_range_start: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          execution_time_ms?: number | null
          filters?: Json | null
          id?: string
          metadata?: Json | null
          query_type: string
          results_count?: number | null
          time_range_end?: string | null
          time_range_start?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          execution_time_ms?: number | null
          filters?: Json | null
          id?: string
          metadata?: Json | null
          query_type?: string
          results_count?: number | null
          time_range_end?: string | null
          time_range_start?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forensics_query_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_sources: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          actual_time: string | null
          created_at: string | null
          created_by: string | null
          from_batch_id: string
          from_vehicle_id: string
          id: string
          location_lat: number
          location_lng: number
          notes: string | null
          scheduled_time: string | null
          status: string | null
          to_vehicle_id: string
        }
        Insert: {
          actual_time?: string | null
          created_at?: string | null
          created_by?: string | null
          from_batch_id: string
          from_vehicle_id: string
          id?: string
          location_lat: number
          location_lng: number
          notes?: string | null
          scheduled_time?: string | null
          status?: string | null
          to_vehicle_id: string
        }
        Update: {
          actual_time?: string | null
          created_at?: string | null
          created_by?: string | null
          from_batch_id?: string
          from_vehicle_id?: string
          id?: string
          location_lat?: number
          location_lng?: number
          notes?: string | null
          scheduled_time?: string | null
          status?: string | null
          to_vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_from_batch_id_fkey"
            columns: ["from_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      implementing_partners: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_transfer_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          quantity_received: number
          quantity_sent: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          quantity_received?: number
          quantity_sent: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity_received?: number
          quantity_sent?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          dispatched_at: string | null
          from_node_id: string
          id: string
          initiated_by: string | null
          notes: string | null
          status: string
          to_node_id: string
          transfer_number: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_node_id: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string
          to_node_id: string
          transfer_number: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_node_id?: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string
          to_node_id?: string
          transfer_number?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          batch_number: string | null
          category: string | null
          created_at: string | null
          description: string
          expiry_date: string | null
          id: string
          invoice_id: string
          item_id: string | null
          mfg_date: string | null
          quantity: number | null
          serial_number: string | null
          total_price: number | null
          unit_pack: string | null
          unit_price: number | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          batch_number?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          expiry_date?: string | null
          id?: string
          invoice_id: string
          item_id?: string | null
          mfg_date?: string | null
          quantity?: number | null
          serial_number?: string | null
          total_price?: number | null
          unit_pack?: string | null
          unit_price?: number | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          batch_number?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          expiry_date?: string | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          mfg_date?: string | null
          quantity?: number | null
          serial_number?: string | null
          total_price?: number | null
          unit_pack?: string | null
          unit_price?: number | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_packaging: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          packaging_mode: string | null
          total_packages: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          packaging_mode?: string | null
          total_packages?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          packaging_mode?: string | null
          total_packages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_packaging_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
          facility_id: string
          id: string
          invoice_number: string
          notes: string | null
          packaging_required: boolean | null
          ref_number: string | null
          requisition_id: string | null
          status: string | null
          total_price: number | null
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
          warehouse_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          facility_id: string
          id?: string
          invoice_number: string
          notes?: string | null
          packaging_required?: boolean | null
          ref_number?: string | null
          requisition_id?: string | null
          status?: string | null
          total_price?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          warehouse_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          facility_id?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          packaging_required?: boolean | null
          ref_number?: string | null
          requisition_id?: string | null
          status?: string | null
          total_price?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          warehouse_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "invoices_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          batch_number: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string
          expiry_date: string | null
          id: string
          lot_number: string | null
          mfg_date: string | null
          program: string | null
          serial_number: string
          stock_on_hand: number | null
          store_address: string | null
          unit_pack: string | null
          unit_price: number | null
          updated_at: string | null
          volume_m3: number | null
          warehouse_id: string | null
          weight_kg: number | null
          workspace_id: string
        }
        Insert: {
          batch_number?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description: string
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          mfg_date?: string | null
          program?: string | null
          serial_number: string
          stock_on_hand?: number | null
          store_address?: string | null
          unit_pack?: string | null
          unit_price?: number | null
          updated_at?: string | null
          volume_m3?: number | null
          warehouse_id?: string | null
          weight_kg?: number | null
          workspace_id: string
        }
        Update: {
          batch_number?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          mfg_date?: string | null
          program?: string | null
          serial_number?: string
          stock_on_hand?: number | null
          store_address?: string | null
          unit_pack?: string | null
          unit_price?: number | null
          updated_at?: string | null
          volume_m3?: number | null
          warehouse_id?: string | null
          weight_kg?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      levels_of_care: {
        Row: {
          created_at: string
          description: string | null
          hierarchy_level: number | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_action_audit: {
        Row: {
          action_location: unknown
          action_type: string
          capability: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          success: boolean | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action_location?: unknown
          action_type: string
          capability: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          success?: boolean | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action_location?: unknown
          action_type?: string
          capability?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          success?: boolean | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_action_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          workspace_member_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id: string
          workspace_member_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          workspace_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_member_permissions_workspace_member"
            columns: ["workspace_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      mod4_driver_links: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          link_method: string
          linked_at: string
          linked_by: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          link_method: string
          linked_at?: string
          linked_by: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          link_method?: string
          linked_at?: string
          linked_by?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mod4_driver_links_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      mod4_event_sync_queue: {
        Row: {
          created_at: string | null
          device_id: string
          driver_id: string
          encrypted_payload: string
          encryption_iv: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          processed_at: string | null
          processed_event_id: string | null
          retry_count: number | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          driver_id: string
          encrypted_payload: string
          encryption_iv: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          processed_at?: string | null
          processed_event_id?: string | null
          retry_count?: number | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          driver_id?: string
          encrypted_payload?: string
          encryption_iv?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          processed_at?: string | null
          processed_event_id?: string | null
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mod4_event_sync_queue_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_event_sync_queue_processed_event_id_fkey"
            columns: ["processed_event_id"]
            isOneToOne: false
            referencedRelation: "mod4_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      mod4_events: {
        Row: {
          batch_id: string | null
          captured_at: string
          created_at: string | null
          device_id: string
          dispatch_id: string | null
          driver_id: string
          event_id: string
          event_type: string
          lat: number
          lng: number
          metadata: Json
          received_at: string | null
          session_id: string
          sync_attempts: number | null
          sync_status: string | null
          trip_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          batch_id?: string | null
          captured_at: string
          created_at?: string | null
          device_id: string
          dispatch_id?: string | null
          driver_id: string
          event_id?: string
          event_type: string
          lat: number
          lng: number
          metadata?: Json
          received_at?: string | null
          session_id: string
          sync_attempts?: number | null
          sync_status?: string | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          batch_id?: string | null
          captured_at?: string
          created_at?: string | null
          device_id?: string
          dispatch_id?: string | null
          driver_id?: string
          event_id?: string
          event_type?: string
          lat?: number
          lng?: number
          metadata?: Json
          received_at?: string | null
          session_id?: string
          sync_attempts?: number | null
          sync_status?: string | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mod4_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod4_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      mod4_otp_codes: {
        Row: {
          attempts: number | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_attempts: number | null
          otp_code: string
          status: string
          target_email: string
          updated_at: string | null
          used_at: string | null
          used_by: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          otp_code: string
          status?: string
          target_email: string
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          otp_code?: string
          status?: string
          target_email?: string
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mod4_otp_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      onboarding_requests: {
        Row: {
          created_at: string
          device_id: string | null
          email: string | null
          full_name: string
          id: string
          organization_hint: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          organization_hint?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          organization_hint?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      optimization_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          estimated_duration: number
          expires_at: string
          facility_ids: string[]
          id: string
          optimized_route: Json
          total_distance: number
          warehouse_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          estimated_duration: number
          expires_at: string
          facility_ids: string[]
          id?: string
          optimized_route: Json
          total_distance: number
          warehouse_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          estimated_duration?: number
          expires_at?: string
          facility_ids?: string[]
          id?: string
          optimized_route?: Json
          total_distance?: number
          warehouse_id?: string
        }
        Relationships: []
      }
      optimization_runs: {
        Row: {
          algorithm_used: string | null
          avg_capacity_utilization: number | null
          capacity_threshold: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          facility_ids: string[]
          id: string
          optimization_time_ms: number | null
          priority_weights: Json | null
          result_batches: Json | null
          run_name: string | null
          scheduler_batch_ids: string[] | null
          status: Database["public"]["Enums"]["optimization_status"] | null
          time_window_mode: string | null
          total_batches_created: number | null
          total_distance_km: number | null
          total_duration_min: number | null
          vehicle_constraints: Json | null
          warehouse_id: string | null
        }
        Insert: {
          algorithm_used?: string | null
          avg_capacity_utilization?: number | null
          capacity_threshold?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          facility_ids: string[]
          id?: string
          optimization_time_ms?: number | null
          priority_weights?: Json | null
          result_batches?: Json | null
          run_name?: string | null
          scheduler_batch_ids?: string[] | null
          status?: Database["public"]["Enums"]["optimization_status"] | null
          time_window_mode?: string | null
          total_batches_created?: number | null
          total_distance_km?: number | null
          total_duration_min?: number | null
          vehicle_constraints?: Json | null
          warehouse_id?: string | null
        }
        Update: {
          algorithm_used?: string | null
          avg_capacity_utilization?: number | null
          capacity_threshold?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          facility_ids?: string[]
          id?: string
          optimization_time_ms?: number | null
          priority_weights?: Json | null
          result_batches?: Json | null
          run_name?: string | null
          scheduler_batch_ids?: string[] | null
          status?: Database["public"]["Enums"]["optimization_status"] | null
          time_window_mode?: string | null
          total_batches_created?: number | null
          total_distance_km?: number | null
          total_duration_min?: number | null
          vehicle_constraints?: Json | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_runs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      org_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["org_status"]
          previous_status: Database["public"]["Enums"]["org_status"] | null
          reason: string | null
          workspace_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status: Database["public"]["Enums"]["org_status"]
          previous_status?: Database["public"]["Enums"]["org_status"] | null
          reason?: string | null
          workspace_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["org_status"]
          previous_status?: Database["public"]["Enums"]["org_status"] | null
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_status_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          id: string
          item_ids: string[] | null
          package_number: number | null
          package_type: string | null
          packaging_id: string
          size: string | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          id?: string
          item_ids?: string[] | null
          package_number?: number | null
          package_type?: string | null
          packaging_id: string
          size?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          id?: string
          item_ids?: string[] | null
          package_number?: number | null
          package_type?: string | null
          packaging_id?: string
          size?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "invoice_packaging"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_slot_costs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_volume_m3: number | null
          max_weight_kg: number | null
          packaging_type: string
          slot_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          packaging_type: string
          slot_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          packaging_type?: string
          slot_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      payload_items: {
        Row: {
          batch_id: string | null
          box_type: string | null
          created_at: string | null
          custom_height_cm: number | null
          custom_length_cm: number | null
          custom_width_cm: number | null
          facility_id: string | null
          id: string
          payload_id: string | null
          quantity: number | null
          status: string | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          batch_id?: string | null
          box_type?: string | null
          created_at?: string | null
          custom_height_cm?: number | null
          custom_length_cm?: number | null
          custom_width_cm?: number | null
          facility_id?: string | null
          id?: string
          payload_id?: string | null
          quantity?: number | null
          status?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          batch_id?: string | null
          box_type?: string | null
          created_at?: string | null
          custom_height_cm?: number | null
          custom_length_cm?: number | null
          custom_width_cm?: number | null
          facility_id?: string | null
          id?: string
          payload_id?: string | null
          quantity?: number | null
          status?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payload_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payload_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payload_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "payload_items_payload_id_fkey"
            columns: ["payload_id"]
            isOneToOne: false
            referencedRelation: "payloads"
            referencedColumns: ["id"]
          },
        ]
      }
      payloads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string | null
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
          utilization_pct: number | null
          vehicle_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          utilization_pct?: number | null
          vehicle_id?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          utilization_pct?: number | null
          vehicle_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          category: string
          code: string
          created_at: string | null
          description: string
          id: string
          is_dangerous: boolean | null
          resource: string
          updated_at: string | null
        }
        Insert: {
          action: string
          category: string
          code: string
          created_at?: string | null
          description: string
          id?: string
          is_dangerous?: boolean | null
          resource: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          category?: string
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          is_dangerous?: boolean | null
          resource?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      policy_cluster_facilities: {
        Row: {
          assigned_at: string
          cluster_id: string
          facility_id: string
          id: string
        }
        Insert: {
          assigned_at?: string
          cluster_id: string
          facility_id: string
          id?: string
        }
        Update: {
          assigned_at?: string
          cluster_id?: string
          facility_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_cluster_facilities_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "policy_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_cluster_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_cluster_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
        ]
      }
      policy_clusters: {
        Row: {
          avg_distance_km: number | null
          centroid_lat: number | null
          centroid_lng: number | null
          code: string
          created_at: string
          facility_count: number
          id: string
          name: string | null
          service_policy_id: string
          sort_order: number
        }
        Insert: {
          avg_distance_km?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          code: string
          created_at?: string
          facility_count?: number
          id?: string
          name?: string | null
          service_policy_id: string
          sort_order?: number
        }
        Update: {
          avg_distance_km?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          code?: string
          created_at?: string
          facility_count?: number
          id?: string
          name?: string | null
          service_policy_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_clusters_service_policy_id_fkey"
            columns: ["service_policy_id"]
            isOneToOne: false
            referencedRelation: "service_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          language: string | null
          onboarding_completed: boolean | null
          organization: string | null
          phone: string | null
          registered_at: string | null
          role_assigned_at: string | null
          timezone: string | null
          updated_at: string | null
          user_status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          invited_at?: string | null
          invited_by?: string | null
          language?: string | null
          onboarding_completed?: boolean | null
          organization?: string | null
          phone?: string | null
          registered_at?: string | null
          role_assigned_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          language?: string | null
          onboarding_completed?: boolean | null
          organization?: string | null
          phone?: string | null
          registered_at?: string | null
          role_assigned_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: []
      }
      programme_categories: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          created_at: string
          description: string | null
          funding_source: string | null
          funding_source_id: string | null
          id: string
          name: string
          priority_tier: string
          requires_cold_chain: boolean
          sla_days: number | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          funding_source?: string | null
          funding_source_id?: string | null
          id?: string
          name: string
          priority_tier?: string
          requires_cold_chain?: boolean
          sla_days?: number | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          funding_source?: string | null
          funding_source_id?: string | null
          id?: string
          name?: string
          priority_tier?: string
          requires_cold_chain?: boolean
          sla_days?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_funding_source_id_fkey"
            columns: ["funding_source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          target_user_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          active: boolean | null
          created_at: string | null
          end_date: string | null
          facility_ids: string[]
          id: string
          medication_type: string
          name: string
          priority: Database["public"]["Enums"]["delivery_priority"] | null
          quantity: number
          recurrence_days: number[] | null
          recurrence_type: string
          scheduled_time: string
          start_date: string
          warehouse_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          facility_ids: string[]
          id?: string
          medication_type: string
          name: string
          priority?: Database["public"]["Enums"]["delivery_priority"] | null
          quantity: number
          recurrence_days?: number[] | null
          recurrence_type: string
          scheduled_time: string
          start_date: string
          warehouse_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          facility_ids?: string[]
          id?: string
          medication_type?: string
          name?: string
          priority?: Database["public"]["Enums"]["delivery_priority"] | null
          quantity?: number
          recurrence_days?: number[] | null
          recurrence_type?: string
          scheduled_time?: string
          start_date?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_items: {
        Row: {
          created_at: string
          handling_instructions: string | null
          id: string
          item_name: string
          qty_issued: number | null
          qty_received: number | null
          qty_returned: number | null
          quantity: number
          requisition_id: string
          temperature_required: boolean | null
          total_price: number | null
          unit: string
          unit_price: number | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          handling_instructions?: string | null
          id?: string
          item_name: string
          qty_issued?: number | null
          qty_received?: number | null
          qty_returned?: number | null
          quantity: number
          requisition_id: string
          temperature_required?: boolean | null
          total_price?: number | null
          unit?: string
          unit_price?: number | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          handling_instructions?: string | null
          id?: string
          item_name?: string
          qty_issued?: number | null
          qty_received?: number | null
          qty_returned?: number | null
          quantity?: number
          requisition_id?: string
          temperature_required?: boolean | null
          total_price?: number | null
          unit?: string
          unit_price?: number | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      requisition_packaging: {
        Row: {
          computed_at: string
          computed_by: string | null
          created_at: string
          id: string
          is_final: boolean | null
          packaging_version: number
          requisition_id: string
          rounded_slot_demand: number
          total_items: number | null
          total_slot_demand: number
          total_volume_m3: number | null
          total_weight_kg: number | null
        }
        Insert: {
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          packaging_version?: number
          requisition_id: string
          rounded_slot_demand: number
          total_items?: number | null
          total_slot_demand: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
        }
        Update: {
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          packaging_version?: number
          requisition_id?: string
          rounded_slot_demand?: number
          total_items?: number | null
          total_slot_demand?: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_packaging_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: true
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_packaging_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          package_count: number
          packaging_type: string
          quantity: number
          requisition_item_id: string
          requisition_packaging_id: string
          slot_cost: number
          slot_demand: number
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          package_count?: number
          packaging_type: string
          quantity: number
          requisition_item_id: string
          requisition_packaging_id: string
          slot_cost: number
          slot_demand: number
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          package_count?: number
          packaging_type?: string
          quantity?: number
          requisition_item_id?: string
          requisition_packaging_id?: string
          slot_cost?: number
          slot_demand?: number
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_packaging_items_requisition_item_id_fkey"
            columns: ["requisition_item_id"]
            isOneToOne: false
            referencedRelation: "requisition_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_packaging_items_requisition_packaging_id_fkey"
            columns: ["requisition_packaging_id"]
            isOneToOne: false
            referencedRelation: "requisition_packaging"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to_batch_at: string | null
          batch_id: string | null
          created_at: string
          delivered_at: string | null
          facility_id: string
          facility_incharge: string | null
          fulfilled_at: string | null
          id: string
          in_transit_at: string | null
          issued_to: string | null
          notes: string | null
          packaged_at: string | null
          pharmacy_incharge: string | null
          priority: string
          program: string | null
          purpose: string | null
          ready_for_dispatch_at: string | null
          received_from: string | null
          rejection_reason: string | null
          requested_by: string
          requested_delivery_date: string
          requisition_number: string
          sriv_number: string | null
          status: string
          submission_date: string | null
          updated_at: string
          warehouse_id: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_batch_at?: string | null
          batch_id?: string | null
          created_at?: string
          delivered_at?: string | null
          facility_id: string
          facility_incharge?: string | null
          fulfilled_at?: string | null
          id?: string
          in_transit_at?: string | null
          issued_to?: string | null
          notes?: string | null
          packaged_at?: string | null
          pharmacy_incharge?: string | null
          priority?: string
          program?: string | null
          purpose?: string | null
          ready_for_dispatch_at?: string | null
          received_from?: string | null
          rejection_reason?: string | null
          requested_by: string
          requested_delivery_date: string
          requisition_number: string
          sriv_number?: string | null
          status?: string
          submission_date?: string | null
          updated_at?: string
          warehouse_id: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_batch_at?: string | null
          batch_id?: string | null
          created_at?: string
          delivered_at?: string | null
          facility_id?: string
          facility_incharge?: string | null
          fulfilled_at?: string | null
          id?: string
          in_transit_at?: string | null
          issued_to?: string | null
          notes?: string | null
          packaged_at?: string | null
          pharmacy_incharge?: string | null
          priority?: string
          program?: string | null
          purpose?: string | null
          ready_for_dispatch_at?: string | null
          received_from?: string | null
          rejection_reason?: string | null
          requested_by?: string
          requested_delivery_date?: string
          requisition_number?: string
          sriv_number?: string | null
          status?: string
          submission_date?: string | null
          updated_at?: string
          warehouse_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "requisitions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_system_role: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      route_facilities: {
        Row: {
          distance_from_previous_km: number | null
          estimated_arrival_min: number | null
          facility_id: string
          id: string
          metadata: Json
          route_id: string
          sequence_order: number
        }
        Insert: {
          distance_from_previous_km?: number | null
          estimated_arrival_min?: number | null
          facility_id: string
          id?: string
          metadata?: Json
          route_id: string
          sequence_order: number
        }
        Update: {
          distance_from_previous_km?: number | null
          estimated_arrival_min?: number | null
          facility_id?: string
          id?: string
          metadata?: Json
          route_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "route_facilities_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_history: {
        Row: {
          actual_arrival: string | null
          actual_duration: number | null
          batch_id: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          delay_reason: string | null
          distance_from_previous: number | null
          facility_id: string
          handoff_id: string | null
          id: string
          notes: string | null
          planned_arrival: string | null
          planned_duration: number | null
          proof_of_delivery_url: string | null
          recipient_name: string | null
          sequence_number: number
          status: string | null
        }
        Insert: {
          actual_arrival?: string | null
          actual_duration?: number | null
          batch_id: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          delay_reason?: string | null
          distance_from_previous?: number | null
          facility_id: string
          handoff_id?: string | null
          id?: string
          notes?: string | null
          planned_arrival?: string | null
          planned_duration?: number | null
          proof_of_delivery_url?: string | null
          recipient_name?: string | null
          sequence_number: number
          status?: string | null
        }
        Update: {
          actual_arrival?: string | null
          actual_duration?: number | null
          batch_id?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          delay_reason?: string | null
          distance_from_previous?: number | null
          facility_id?: string
          handoff_id?: string | null
          id?: string
          notes?: string | null
          planned_arrival?: string | null
          planned_duration?: number | null
          proof_of_delivery_url?: string | null
          recipient_name?: string | null
          sequence_number?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_history_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_history_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_history_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "route_history_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      route_sketches: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string | null
          description: string | null
          end_facility_id: string | null
          estimated_distance: number | null
          estimated_duration: number | null
          id: string
          metadata: Json | null
          name: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_geometry: unknown
          route_type: string | null
          start_facility_id: string | null
          updated_at: string | null
          waypoints: Json | null
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_facility_id?: string | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          id?: string
          metadata?: Json | null
          name: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_geometry: unknown
          route_type?: string | null
          start_facility_id?: string | null
          updated_at?: string | null
          waypoints?: Json | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_facility_id?: string | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_geometry?: unknown
          route_type?: string | null
          start_facility_id?: string | null
          updated_at?: string | null
          waypoints?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_sketches_end_facility_id_fkey"
            columns: ["end_facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_sketches_end_facility_id_fkey"
            columns: ["end_facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "route_sketches_start_facility_id_fkey"
            columns: ["start_facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_sketches_start_facility_id_fkey"
            columns: ["start_facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "route_sketches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          algorithm_used: string | null
          created_at: string
          created_by: string | null
          creation_mode: string
          estimated_duration_min: number | null
          id: string
          is_sandbox: boolean
          locked_at: string | null
          locked_by: string | null
          metadata: Json
          name: string
          optimized_geometry: Json | null
          service_area_id: string
          status: string
          total_distance_km: number | null
          updated_at: string
          updated_by: string | null
          warehouse_id: string
          workspace_id: string
          zone_id: string
        }
        Insert: {
          algorithm_used?: string | null
          created_at?: string
          created_by?: string | null
          creation_mode?: string
          estimated_duration_min?: number | null
          id?: string
          is_sandbox?: boolean
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          name: string
          optimized_geometry?: Json | null
          service_area_id: string
          status?: string
          total_distance_km?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
          workspace_id: string
          zone_id: string
        }
        Update: {
          algorithm_used?: string | null
          created_at?: string
          created_by?: string | null
          creation_mode?: string
          estimated_duration_min?: number | null
          id?: string
          is_sandbox?: boolean
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          name?: string
          optimized_geometry?: Json | null
          service_area_id?: string
          status?: string
          total_distance_km?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
          workspace_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          active: boolean | null
          auto_schedule: boolean | null
          created_at: string | null
          created_by: string | null
          default_driver_id: string | null
          default_vehicle_id: string | null
          description: string | null
          facility_ids: string[]
          id: string
          last_used_at: string | null
          name: string
          priority: string | null
          recurrence_days: number[] | null
          recurrence_type: string | null
          time_window: string | null
          updated_at: string | null
          usage_count: number | null
          warehouse_id: string | null
        }
        Insert: {
          active?: boolean | null
          auto_schedule?: boolean | null
          created_at?: string | null
          created_by?: string | null
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          description?: string | null
          facility_ids?: string[]
          id?: string
          last_used_at?: string | null
          name: string
          priority?: string | null
          recurrence_days?: number[] | null
          recurrence_type?: string | null
          time_window?: string | null
          updated_at?: string | null
          usage_count?: number | null
          warehouse_id?: string | null
        }
        Update: {
          active?: boolean | null
          auto_schedule?: boolean | null
          created_at?: string | null
          created_by?: string | null
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          description?: string | null
          facility_ids?: string[]
          id?: string
          last_used_at?: string | null
          name?: string
          priority?: string | null
          recurrence_days?: number[] | null
          recurrence_type?: string | null
          time_window?: string | null
          updated_at?: string | null
          usage_count?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_batches: {
        Row: {
          batch_code: string | null
          capacity_utilization_pct: number | null
          created_at: string | null
          created_by: string | null
          driver_id: string | null
          estimated_duration_min: number | null
          facility_ids: string[]
          id: string
          name: string | null
          notes: string | null
          optimized_route: Json | null
          planned_date: string
          priority: string | null
          published_at: string | null
          published_batch_id: string | null
          scheduled_at: string | null
          scheduling_mode: Database["public"]["Enums"]["scheduling_mode"] | null
          status: Database["public"]["Enums"]["scheduler_batch_status"] | null
          tags: string[] | null
          time_window: string | null
          total_consignments: number | null
          total_distance_km: number | null
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
          vehicle_id: string | null
          warehouse_id: string | null
          zone: string | null
        }
        Insert: {
          batch_code?: string | null
          capacity_utilization_pct?: number | null
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          estimated_duration_min?: number | null
          facility_ids?: string[]
          id?: string
          name?: string | null
          notes?: string | null
          optimized_route?: Json | null
          planned_date: string
          priority?: string | null
          published_at?: string | null
          published_batch_id?: string | null
          scheduled_at?: string | null
          scheduling_mode?:
            | Database["public"]["Enums"]["scheduling_mode"]
            | null
          status?: Database["public"]["Enums"]["scheduler_batch_status"] | null
          tags?: string[] | null
          time_window?: string | null
          total_consignments?: number | null
          total_distance_km?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          warehouse_id?: string | null
          zone?: string | null
        }
        Update: {
          batch_code?: string | null
          capacity_utilization_pct?: number | null
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          estimated_duration_min?: number | null
          facility_ids?: string[]
          id?: string
          name?: string | null
          notes?: string | null
          optimized_route?: Json | null
          planned_date?: string
          priority?: string | null
          published_at?: string | null
          published_batch_id?: string | null
          scheduled_at?: string | null
          scheduling_mode?:
            | Database["public"]["Enums"]["scheduling_mode"]
            | null
          status?: Database["public"]["Enums"]["scheduler_batch_status"] | null
          tags?: string[] | null
          time_window?: string | null
          total_consignments?: number | null
          total_distance_km?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          warehouse_id?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_batches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_published_batch_id_fkey"
            columns: ["published_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_pre_batches: {
        Row: {
          ai_optimization_options: Json | null
          converted_batch_id: string | null
          created_at: string
          created_by: string | null
          facility_order: string[]
          facility_requisition_map: Json
          id: string
          notes: string | null
          planned_date: string
          schedule_title: string
          source_method: string
          source_sub_option: string | null
          start_location_id: string
          start_location_type: string
          status: string
          suggested_vehicle_id: string | null
          time_window: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_optimization_options?: Json | null
          converted_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          facility_order?: string[]
          facility_requisition_map?: Json
          id?: string
          notes?: string | null
          planned_date: string
          schedule_title: string
          source_method: string
          source_sub_option?: string | null
          start_location_id: string
          start_location_type: string
          status?: string
          suggested_vehicle_id?: string | null
          time_window?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_optimization_options?: Json | null
          converted_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          facility_order?: string[]
          facility_requisition_map?: Json
          id?: string
          notes?: string | null
          planned_date?: string
          schedule_title?: string
          source_method?: string
          source_sub_option?: string | null
          start_location_id?: string
          start_location_type?: string
          status?: string
          suggested_vehicle_id?: string | null
          time_window?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_pre_batches_converted_batch_id_fkey"
            columns: ["converted_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_pre_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_settings: {
        Row: {
          auto_cluster_enabled: boolean | null
          created_at: string | null
          default_capacity_threshold: number | null
          default_time_window: string | null
          default_view: string | null
          default_warehouse_id: string | null
          id: string
          notify_on_optimization_complete: boolean | null
          notify_on_publish: boolean | null
          show_zones: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_cluster_enabled?: boolean | null
          created_at?: string | null
          default_capacity_threshold?: number | null
          default_time_window?: string | null
          default_view?: string | null
          default_warehouse_id?: string | null
          id?: string
          notify_on_optimization_complete?: boolean | null
          notify_on_publish?: boolean | null
          show_zones?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_cluster_enabled?: boolean | null
          created_at?: string | null
          default_capacity_threshold?: number | null
          default_time_window?: string | null
          default_view?: string | null
          default_warehouse_id?: string | null
          id?: string
          notify_on_optimization_complete?: boolean | null
          notify_on_publish?: boolean | null
          show_zones?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_settings_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_area_facilities: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          facility_id: string
          id: string
          service_area_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          facility_id: string
          id?: string
          service_area_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          facility_id?: string
          id?: string
          service_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_area_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_area_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "service_area_facilities_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_frequency: string | null
          description: string | null
          id: string
          is_active: boolean
          max_distance_km: number | null
          metadata: Json
          name: string
          priority: string
          service_type: string
          sla_hours: number | null
          updated_at: string
          updated_by: string | null
          warehouse_id: string
          workspace_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_frequency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          metadata?: Json
          name: string
          priority?: string
          service_type?: string
          sla_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
          workspace_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_frequency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          metadata?: Json
          name?: string
          priority?: string
          service_type?: string
          sla_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
          workspace_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_areas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_areas_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "service_areas_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_metrics"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "service_areas_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      service_policies: {
        Row: {
          clustering_mode: string
          code: string | null
          constraints: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          service_area_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          clustering_mode?: string
          code?: string | null
          constraints?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          service_area_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          clustering_mode?: string
          code?: string | null
          constraints?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          service_area_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_policies_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_zones: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          geometry: Json
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geometry: Json
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geometry?: Json
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      slot_assignments: {
        Row: {
          batch_id: string
          batch_type: string
          created_at: string | null
          created_by: string | null
          facility_id: string
          id: string
          load_kg: number | null
          load_volume_m3: number | null
          sequence_order: number | null
          slot_key: string
          slot_number: number
          status: string | null
          tier_name: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          batch_id: string
          batch_type?: string
          created_at?: string | null
          created_by?: string | null
          facility_id: string
          id?: string
          load_kg?: number | null
          load_volume_m3?: number | null
          sequence_order?: number | null
          slot_key: string
          slot_number: number
          status?: string | null
          tier_name: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          batch_id?: string
          batch_type?: string
          created_at?: string | null
          created_by?: string | null
          facility_id?: string
          id?: string
          load_kg?: number | null
          load_volume_m3?: number | null
          sequence_order?: number | null
          slot_key?: string
          slot_number?: number
          status?: string | null
          tier_name?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value_numeric: number | null
          value_text: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value_numeric?: number | null
          value_text?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value_numeric?: number | null
          value_text?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      trade_off_confirmations: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          driver_id: string
          driver_name: string
          id: string
          role: string
          trade_off_id: string
          vehicle_id: string | null
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          driver_id: string
          driver_name: string
          id?: string
          role: string
          trade_off_id: string
          vehicle_id?: string | null
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          driver_id?: string
          driver_name?: string
          id?: string
          role?: string
          trade_off_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_off_confirmations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_trade_off_id_fkey"
            columns: ["trade_off_id"]
            isOneToOne: false
            referencedRelation: "trade_offs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_off_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_off_items: {
        Row: {
          allocated_quantities: Json
          created_at: string | null
          id: string
          item_name: string
          original_quantity: number
          trade_off_id: string
          unit: string
        }
        Insert: {
          allocated_quantities?: Json
          created_at?: string | null
          id?: string
          item_name: string
          original_quantity: number
          trade_off_id: string
          unit?: string
        }
        Update: {
          allocated_quantities?: Json
          created_at?: string | null
          id?: string
          item_name?: string
          original_quantity?: number
          trade_off_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_off_items_trade_off_id_fkey"
            columns: ["trade_off_id"]
            isOneToOne: false
            referencedRelation: "trade_offs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_offs: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          executed_at: string | null
          handover_lat: number | null
          handover_lng: number | null
          id: string
          initiated_by: string | null
          original_dispatch_id: string | null
          reason: string | null
          receiving_vehicle_ids: string[]
          source_driver_id: string | null
          source_vehicle_id: string | null
          status: Database["public"]["Enums"]["tradeoff_status"]
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          handover_lat?: number | null
          handover_lng?: number | null
          id?: string
          initiated_by?: string | null
          original_dispatch_id?: string | null
          reason?: string | null
          receiving_vehicle_ids?: string[]
          source_driver_id?: string | null
          source_vehicle_id?: string | null
          status?: Database["public"]["Enums"]["tradeoff_status"]
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          handover_lat?: number | null
          handover_lng?: number | null
          id?: string
          initiated_by?: string | null
          original_dispatch_id?: string | null
          reason?: string | null
          receiving_vehicle_ids?: string[]
          source_driver_id?: string | null
          source_vehicle_id?: string | null
          status?: Database["public"]["Enums"]["tradeoff_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_offs_source_driver_id_fkey"
            columns: ["source_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      tradeoff_confirmations: {
        Row: {
          confirmation_location: unknown
          confirmed_at: string | null
          created_at: string | null
          driver_id: string
          id: string
          metadata: Json | null
          rejected_at: string | null
          response_notes: string | null
          status: string
          tradeoff_id: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          confirmation_location?: unknown
          confirmed_at?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          metadata?: Json | null
          rejected_at?: string | null
          response_notes?: string | null
          status?: string
          tradeoff_id: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          confirmation_location?: unknown
          confirmed_at?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          metadata?: Json | null
          rejected_at?: string | null
          response_notes?: string | null
          status?: string
          tradeoff_id?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tradeoff_confirmations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_tradeoff_id_fkey"
            columns: ["tradeoff_id"]
            isOneToOne: false
            referencedRelation: "tradeoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      tradeoff_items: {
        Row: {
          assigned_to_driver_id: string | null
          assigned_to_vehicle_id: string | null
          batch_id: string | null
          created_at: string | null
          facility_id: string | null
          id: string
          item_count: number | null
          item_type: string | null
          metadata: Json | null
          original_driver_id: string | null
          original_vehicle_id: string | null
          tradeoff_id: string
          transfer_confirmed: boolean | null
          transferred_at: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_driver_id?: string | null
          assigned_to_vehicle_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          facility_id?: string | null
          id?: string
          item_count?: number | null
          item_type?: string | null
          metadata?: Json | null
          original_driver_id?: string | null
          original_vehicle_id?: string | null
          tradeoff_id: string
          transfer_confirmed?: boolean | null
          transferred_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_driver_id?: string | null
          assigned_to_vehicle_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          facility_id?: string | null
          id?: string
          item_count?: number | null
          item_type?: string | null
          metadata?: Json | null
          original_driver_id?: string | null
          original_vehicle_id?: string | null
          tradeoff_id?: string
          transfer_confirmed?: boolean | null
          transferred_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tradeoff_items_assigned_to_driver_id_fkey"
            columns: ["assigned_to_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_driver_id_fkey"
            columns: ["original_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_original_vehicle_id_fkey"
            columns: ["original_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_items_tradeoff_id_fkey"
            columns: ["tradeoff_id"]
            isOneToOne: false
            referencedRelation: "tradeoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tradeoff_routes: {
        Row: {
          created_at: string | null
          estimated_duration: number | null
          id: string
          metadata: Json | null
          route_geometry: unknown
          route_type: string
          total_distance: number | null
          tradeoff_id: string
          vehicle_id: string
          waypoints: Json | null
        }
        Insert: {
          created_at?: string | null
          estimated_duration?: number | null
          id?: string
          metadata?: Json | null
          route_geometry: unknown
          route_type: string
          total_distance?: number | null
          tradeoff_id: string
          vehicle_id: string
          waypoints?: Json | null
        }
        Update: {
          created_at?: string | null
          estimated_duration?: number | null
          id?: string
          metadata?: Json | null
          route_geometry?: unknown
          route_type?: string
          total_distance?: number | null
          tradeoff_id?: string
          vehicle_id?: string
          waypoints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tradeoff_routes_tradeoff_id_fkey"
            columns: ["tradeoff_id"]
            isOneToOne: false
            referencedRelation: "tradeoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoff_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      tradeoffs: {
        Row: {
          actual_distance_saved: number | null
          actual_fuel_saved: number | null
          actual_time_saved: number | null
          completed_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          estimated_distance_saved: number | null
          estimated_fuel_saved: number | null
          estimated_time_saved: number | null
          executed_at: string | null
          handover_address: string | null
          handover_notes: string | null
          handover_point: unknown
          id: string
          initiated_at: string
          initiated_by: string | null
          metadata: Json | null
          receiving_vehicle_ids: string[]
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requires_confirmation: boolean | null
          source_driver_id: string | null
          source_vehicle_id: string
          status: string
          success_rate: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          actual_distance_saved?: number | null
          actual_fuel_saved?: number | null
          actual_time_saved?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          estimated_distance_saved?: number | null
          estimated_fuel_saved?: number | null
          estimated_time_saved?: number | null
          executed_at?: string | null
          handover_address?: string | null
          handover_notes?: string | null
          handover_point: unknown
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          metadata?: Json | null
          receiving_vehicle_ids?: string[]
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_confirmation?: boolean | null
          source_driver_id?: string | null
          source_vehicle_id: string
          status?: string
          success_rate?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          actual_distance_saved?: number | null
          actual_fuel_saved?: number | null
          actual_time_saved?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          estimated_distance_saved?: number | null
          estimated_fuel_saved?: number | null
          estimated_time_saved?: number | null
          executed_at?: string | null
          handover_address?: string | null
          handover_notes?: string | null
          handover_point?: unknown
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          metadata?: Json | null
          receiving_vehicle_ids?: string[]
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_confirmation?: boolean | null
          source_driver_id?: string | null
          source_vehicle_id?: string
          status?: string
          success_rate?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tradeoffs_source_driver_id_fkey"
            columns: ["source_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradeoffs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expired_at: string | null
          expires_at: string
          id: string
          invitation_token: string
          invited_at: string
          invited_by: string
          personal_message: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
          workspace_id: string
          workspace_role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_at?: string
          invited_by: string
          personal_message?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          workspace_id: string
          workspace_role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_at?: string
          invited_by?: string
          personal_message?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          workspace_id?: string
          workspace_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          in_app_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          in_app_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          in_app_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["user_status"]
          previous_status: Database["public"]["Enums"]["user_status"] | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status: Database["public"]["Enums"]["user_status"]
          previous_status?: Database["public"]["Enums"]["user_status"] | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["user_status"]
          previous_status?: Database["public"]["Enums"]["user_status"] | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_categories: {
        Row: {
          code: string | null
          created_at: string | null
          default_tier_config: Json | null
          description: string | null
          display_name: string
          icon_name: string | null
          id: string
          name: string
          source: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          default_tier_config?: Json | null
          description?: string | null
          display_name: string
          icon_name?: string | null
          id?: string
          name: string
          source?: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          default_tier_config?: Json | null
          description?: string | null
          display_name?: string
          icon_name?: string | null
          id?: string
          name?: string
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicle_maintenance: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          maintenance_type: string
          odometer_reading: number | null
          scheduled_date: string
          status: string | null
          vehicle_id: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_type: string
          odometer_reading?: number | null
          scheduled_date: string
          status?: string | null
          vehicle_id: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_type?: string
          odometer_reading?: number | null
          scheduled_date?: string
          status?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_merge_audit: {
        Row: {
          conflicts: Json | null
          id: string
          merged_at: string | null
          merged_by: string | null
          metadata: Json | null
          notes: string | null
          resolved_conflicts: Json | null
          status: string | null
          vehicles_id: string | null
          vlms_id: string | null
        }
        Insert: {
          conflicts?: Json | null
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          metadata?: Json | null
          notes?: string | null
          resolved_conflicts?: Json | null
          status?: string | null
          vehicles_id?: string | null
          vlms_id?: string | null
        }
        Update: {
          conflicts?: Json | null
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          metadata?: Json | null
          notes?: string | null
          resolved_conflicts?: Json | null
          status?: string | null
          vehicles_id?: string | null
          vlms_id?: string | null
        }
        Relationships: []
      }
      vehicle_tiers: {
        Row: {
          created_at: string | null
          id: string
          max_volume_m3: number | null
          max_weight_kg: number | null
          tier_name: string
          tier_order: number
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          tier_name: string
          tier_order: number
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          tier_name?: string
          tier_order?: number
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_trips: {
        Row: {
          batch_id: string | null
          created_at: string | null
          driver_id: string | null
          end_odometer: number | null
          end_time: string | null
          fuel_consumed: number | null
          id: string
          start_odometer: number | null
          start_time: string | null
          vehicle_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_odometer?: number | null
          end_time?: string | null
          fuel_consumed?: number | null
          id?: string
          start_odometer?: number | null
          start_time?: string | null
          vehicle_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_odometer?: number | null
          end_time?: string | null
          fuel_consumed?: number | null
          id?: string
          start_odometer?: number | null
          start_time?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          category_id: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          default_capacity_kg: number | null
          default_capacity_m3: number | null
          default_tier_config: Json | null
          display_name: string
          icon_name: string | null
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          default_capacity_kg?: number | null
          default_capacity_m3?: number | null
          default_tier_config?: Json | null
          display_name: string
          icon_name?: string | null
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          category_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          default_capacity_kg?: number | null
          default_capacity_m3?: number | null
          default_tier_config?: Json | null
          display_name?: string
          icon_name?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acquisition_date: string | null
          acquisition_mode: string | null
          acquisition_type: string | null
          ai_capacity_image_url: string | null
          ai_generated: boolean | null
          avg_speed: number
          axles: number | null
          capacity: number
          capacity_kg: number | null
          capacity_m3: number | null
          capacity_volume_m3: number | null
          capacity_weight_kg: number | null
          category_id: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          current_book_value: number | null
          current_driver_id: string | null
          current_location_id: string | null
          current_mileage: number | null
          date_acquired: string | null
          depreciation_rate: number | null
          documents: Json | null
          engine_capacity: number | null
          fleet_id: string | null
          fuel_efficiency: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          gross_vehicle_weight_kg: number | null
          gross_weight_kg: number | null
          height_cm: number | null
          id: string
          insurance_expiry: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          interior_height_cm: number | null
          interior_length_cm: number | null
          interior_width_cm: number | null
          last_inspection_date: string | null
          last_service_date: string | null
          legacy_metadata: Json | null
          length_cm: number | null
          license_plate: string | null
          make: string | null
          max_weight: number
          model: string
          next_inspection_date: string | null
          next_service_date: string | null
          notes: string | null
          number_of_axles: number | null
          number_of_wheels: number | null
          photo_uploaded_at: string | null
          photo_url: string | null
          photos: Json | null
          plate_number: string
          purchase_price: number | null
          registration_expiry: string | null
          seating_capacity: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tags: string[] | null
          telematics_id: string | null
          telematics_provider: string | null
          thumbnail_url: string | null
          tiered_config: Json | null
          total_maintenance_cost: number | null
          total_slots: number | null
          transmission: string | null
          type: string
          updated_at: string | null
          updated_by: string | null
          variant: string | null
          vehicle_id: string | null
          vehicle_type: string | null
          vehicle_type_id: string | null
          vendor_name: string | null
          vin: string | null
          warranty_expiry: string | null
          width_cm: number | null
          workspace_id: string
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_mode?: string | null
          acquisition_type?: string | null
          ai_capacity_image_url?: string | null
          ai_generated?: boolean | null
          avg_speed?: number
          axles?: number | null
          capacity: number
          capacity_kg?: number | null
          capacity_m3?: number | null
          capacity_volume_m3?: number | null
          capacity_weight_kg?: number | null
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          date_acquired?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fleet_id?: string | null
          fuel_efficiency: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          gross_vehicle_weight_kg?: number | null
          gross_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          interior_height_cm?: number | null
          interior_length_cm?: number | null
          interior_width_cm?: number | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          legacy_metadata?: Json | null
          length_cm?: number | null
          license_plate?: string | null
          make?: string | null
          max_weight: number
          model: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          number_of_axles?: number | null
          number_of_wheels?: number | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photos?: Json | null
          plate_number: string
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tags?: string[] | null
          telematics_id?: string | null
          telematics_provider?: string | null
          thumbnail_url?: string | null
          tiered_config?: Json | null
          total_maintenance_cost?: number | null
          total_slots?: number | null
          transmission?: string | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          variant?: string | null
          vehicle_id?: string | null
          vehicle_type?: string | null
          vehicle_type_id?: string | null
          vendor_name?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          width_cm?: number | null
          workspace_id: string
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_mode?: string | null
          acquisition_type?: string | null
          ai_capacity_image_url?: string | null
          ai_generated?: boolean | null
          avg_speed?: number
          axles?: number | null
          capacity?: number
          capacity_kg?: number | null
          capacity_m3?: number | null
          capacity_volume_m3?: number | null
          capacity_weight_kg?: number | null
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          date_acquired?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fleet_id?: string | null
          fuel_efficiency?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          gross_vehicle_weight_kg?: number | null
          gross_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          interior_height_cm?: number | null
          interior_length_cm?: number | null
          interior_width_cm?: number | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          legacy_metadata?: Json | null
          length_cm?: number | null
          license_plate?: string | null
          make?: string | null
          max_weight?: number
          model?: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          number_of_axles?: number | null
          number_of_wheels?: number | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photos?: Json | null
          plate_number?: string
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tags?: string[] | null
          telematics_id?: string | null
          telematics_provider?: string | null
          thumbnail_url?: string | null
          tiered_config?: Json | null
          total_maintenance_cost?: number | null
          total_slots?: number | null
          transmission?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          variant?: string | null
          vehicle_id?: string | null
          vehicle_type?: string | null
          vehicle_type_id?: string | null
          vendor_name?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          width_cm?: number | null
          workspace_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          internal_notes: string | null
          lga: string | null
          name: string
          onboarded_at: string | null
          onboarded_by: string | null
          organization_lead_name: string | null
          organization_lead_title: string | null
          organization_type:
            | Database["public"]["Enums"]["organization_type"]
            | null
          primary_email: string | null
          primary_phone: string | null
          services_offered:
            | Database["public"]["Enums"]["vendor_service"][]
            | null
          state: string | null
          vendor_roles: Database["public"]["Enums"]["vendor_role"][]
          vendor_status: Database["public"]["Enums"]["vendor_status"] | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          lga?: string | null
          name: string
          onboarded_at?: string | null
          onboarded_by?: string | null
          organization_lead_name?: string | null
          organization_lead_title?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          primary_email?: string | null
          primary_phone?: string | null
          services_offered?:
            | Database["public"]["Enums"]["vendor_service"][]
            | null
          state?: string | null
          vendor_roles?: Database["public"]["Enums"]["vendor_role"][]
          vendor_status?: Database["public"]["Enums"]["vendor_status"] | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          lga?: string | null
          name?: string
          onboarded_at?: string | null
          onboarded_by?: string | null
          organization_lead_name?: string | null
          organization_lead_title?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          primary_email?: string | null
          primary_phone?: string | null
          services_offered?:
            | Database["public"]["Enums"]["vendor_service"][]
            | null
          state?: string | null
          vendor_roles?: Database["public"]["Enums"]["vendor_role"][]
          vendor_status?: Database["public"]["Enums"]["vendor_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_onboarded_by_fkey"
            columns: ["onboarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_assignments: {
        Row: {
          actual_return_date: string | null
          assigned_location_id: string | null
          assigned_to_id: string | null
          assignment_id: string
          assignment_letter_url: string | null
          assignment_type: string
          authorization_number: string | null
          authorized_by_id: string | null
          condition_end: string | null
          condition_start: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          fuel_level_end: number | null
          fuel_level_start: number | null
          id: string
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          photos_end: Json | null
          photos_start: Json | null
          project_name: string | null
          purpose: string
          return_checklist_url: string | null
          start_date: string
          status: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          actual_return_date?: string | null
          assigned_location_id?: string | null
          assigned_to_id?: string | null
          assignment_id: string
          assignment_letter_url?: string | null
          assignment_type: string
          authorization_number?: string | null
          authorized_by_id?: string | null
          condition_end?: string | null
          condition_start?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          photos_end?: Json | null
          photos_start?: Json | null
          project_name?: string | null
          purpose: string
          return_checklist_url?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          actual_return_date?: string | null
          assigned_location_id?: string | null
          assigned_to_id?: string | null
          assignment_id?: string
          assignment_letter_url?: string | null
          assignment_type?: string
          authorization_number?: string | null
          authorized_by_id?: string | null
          condition_end?: string | null
          condition_start?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          photos_end?: Json | null
          photos_start?: Json | null
          project_name?: string | null
          purpose?: string
          return_checklist_url?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlms_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vlms_assignments_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_authorized_by_id_fkey"
            columns: ["authorized_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_disposal_records: {
        Row: {
          authorized_by_id: string | null
          bill_of_sale_url: string | null
          buyer_address: string | null
          buyer_contact: string | null
          buyer_name: string | null
          created_at: string | null
          created_by: string | null
          disposal_authorization_number: string | null
          disposal_date: string
          disposal_id: string
          disposal_method: string
          disposal_reason: string
          disposal_value: number | null
          final_book_value: number | null
          final_condition: string | null
          final_mileage: number | null
          final_photos: Json | null
          gain_loss: number | null
          id: string
          notes: string | null
          release_documents: Json | null
          total_lifecycle_cost: number | null
          vehicle_id: string
        }
        Insert: {
          authorized_by_id?: string | null
          bill_of_sale_url?: string | null
          buyer_address?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string | null
          created_by?: string | null
          disposal_authorization_number?: string | null
          disposal_date: string
          disposal_id: string
          disposal_method: string
          disposal_reason: string
          disposal_value?: number | null
          final_book_value?: number | null
          final_condition?: string | null
          final_mileage?: number | null
          final_photos?: Json | null
          gain_loss?: number | null
          id?: string
          notes?: string | null
          release_documents?: Json | null
          total_lifecycle_cost?: number | null
          vehicle_id: string
        }
        Update: {
          authorized_by_id?: string | null
          bill_of_sale_url?: string | null
          buyer_address?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string | null
          created_by?: string | null
          disposal_authorization_number?: string | null
          disposal_date?: string
          disposal_id?: string
          disposal_method?: string
          disposal_reason?: string
          disposal_value?: number | null
          final_book_value?: number | null
          final_condition?: string | null
          final_mileage?: number | null
          final_photos?: Json | null
          gain_loss?: number | null
          id?: string
          notes?: string | null
          release_documents?: Json | null
          total_lifecycle_cost?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlms_disposal_records_authorized_by_id_fkey"
            columns: ["authorized_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_disposal_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_fuel_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          driver_id: string | null
          driver_name: string | null
          fuel_card_number: string | null
          fuel_efficiency: number | null
          fuel_type: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          odometer_reading: number
          payment_method: string | null
          quantity: number
          receipt_number: string | null
          receipt_url: string | null
          station_location: string | null
          station_name: string | null
          total_cost: number | null
          transaction_date: string
          transaction_number: string | null
          trip_distance: number | null
          unit_price: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          driver_name?: string | null
          fuel_card_number?: string | null
          fuel_efficiency?: number | null
          fuel_type: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          odometer_reading: number
          payment_method?: string | null
          quantity: number
          receipt_number?: string | null
          receipt_url?: string | null
          station_location?: string | null
          station_name?: string | null
          total_cost?: number | null
          transaction_date?: string
          transaction_number?: string | null
          trip_distance?: number | null
          unit_price: number
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          driver_name?: string | null
          fuel_card_number?: string | null
          fuel_efficiency?: number | null
          fuel_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          odometer_reading?: number
          payment_method?: string | null
          quantity?: number
          receipt_number?: string | null
          receipt_url?: string | null
          station_location?: string | null
          station_name?: string | null
          total_cost?: number | null
          transaction_date?: string
          transaction_number?: string | null
          trip_distance?: number | null
          unit_price?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlms_fuel_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_incidents: {
        Row: {
          action_taken: string | null
          actual_repair_cost: number | null
          cause: string | null
          claim_status: string | null
          created_at: string | null
          created_by: string | null
          damages_description: string | null
          deductible_amount: number | null
          description: string
          driver_id: string | null
          driver_name: string
          estimated_repair_cost: number | null
          id: string
          incident_date: string
          incident_id: string
          incident_type: string
          insurance_claim_number: string | null
          insurance_documents: Json | null
          insurance_payout: number | null
          latitude: number | null
          location: string
          longitude: number | null
          odometer_reading: number | null
          other_parties: string | null
          passengers: string | null
          photos: Json | null
          police_report_number: string | null
          police_report_url: string | null
          police_station: string | null
          preventive_measures: string | null
          resolved_date: string | null
          responsible_party: string | null
          severity: string
          status: string
          updated_at: string | null
          vehicle_condition_before: string | null
          vehicle_id: string
          witness_statements: Json | null
        }
        Insert: {
          action_taken?: string | null
          actual_repair_cost?: number | null
          cause?: string | null
          claim_status?: string | null
          created_at?: string | null
          created_by?: string | null
          damages_description?: string | null
          deductible_amount?: number | null
          description: string
          driver_id?: string | null
          driver_name: string
          estimated_repair_cost?: number | null
          id?: string
          incident_date: string
          incident_id: string
          incident_type: string
          insurance_claim_number?: string | null
          insurance_documents?: Json | null
          insurance_payout?: number | null
          latitude?: number | null
          location: string
          longitude?: number | null
          odometer_reading?: number | null
          other_parties?: string | null
          passengers?: string | null
          photos?: Json | null
          police_report_number?: string | null
          police_report_url?: string | null
          police_station?: string | null
          preventive_measures?: string | null
          resolved_date?: string | null
          responsible_party?: string | null
          severity: string
          status?: string
          updated_at?: string | null
          vehicle_condition_before?: string | null
          vehicle_id: string
          witness_statements?: Json | null
        }
        Update: {
          action_taken?: string | null
          actual_repair_cost?: number | null
          cause?: string | null
          claim_status?: string | null
          created_at?: string | null
          created_by?: string | null
          damages_description?: string | null
          deductible_amount?: number | null
          description?: string
          driver_id?: string | null
          driver_name?: string
          estimated_repair_cost?: number | null
          id?: string
          incident_date?: string
          incident_id?: string
          incident_type?: string
          insurance_claim_number?: string | null
          insurance_documents?: Json | null
          insurance_payout?: number | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          odometer_reading?: number | null
          other_parties?: string | null
          passengers?: string | null
          photos?: Json | null
          police_report_number?: string | null
          police_report_url?: string | null
          police_station?: string | null
          preventive_measures?: string | null
          resolved_date?: string | null
          responsible_party?: string | null
          severity?: string
          status?: string
          updated_at?: string | null
          vehicle_condition_before?: string | null
          vehicle_id?: string
          witness_statements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_inspections: {
        Row: {
          brakes: Json | null
          certificate_expiry_date: string | null
          certificate_issued_date: string | null
          certificate_number: string | null
          checklist: Json
          compliance_notes: string | null
          created_at: string | null
          created_by: string | null
          defects_found: string[] | null
          electrical_system: Json | null
          engine_mechanical: Json | null
          exterior_condition: Json | null
          fluid_levels: Json | null
          id: string
          inspection_date: string
          inspection_id: string
          inspection_report_url: string | null
          inspection_type: string
          inspector_certification: string | null
          inspector_id: string | null
          inspector_name: string
          interior_condition: Json | null
          lights_signals: Json | null
          meets_safety_standards: boolean
          next_inspection_date: string | null
          notes: string | null
          odometer_reading: number | null
          overall_status: string
          photos: Json | null
          priority_repairs: string[] | null
          recommendations: string | null
          reinspection_date: string | null
          reinspection_required: boolean | null
          roadworthy: boolean
          safety_equipment: Json | null
          tires: Json | null
          vehicle_id: string
        }
        Insert: {
          brakes?: Json | null
          certificate_expiry_date?: string | null
          certificate_issued_date?: string | null
          certificate_number?: string | null
          checklist: Json
          compliance_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          defects_found?: string[] | null
          electrical_system?: Json | null
          engine_mechanical?: Json | null
          exterior_condition?: Json | null
          fluid_levels?: Json | null
          id?: string
          inspection_date: string
          inspection_id: string
          inspection_report_url?: string | null
          inspection_type: string
          inspector_certification?: string | null
          inspector_id?: string | null
          inspector_name: string
          interior_condition?: Json | null
          lights_signals?: Json | null
          meets_safety_standards: boolean
          next_inspection_date?: string | null
          notes?: string | null
          odometer_reading?: number | null
          overall_status: string
          photos?: Json | null
          priority_repairs?: string[] | null
          recommendations?: string | null
          reinspection_date?: string | null
          reinspection_required?: boolean | null
          roadworthy: boolean
          safety_equipment?: Json | null
          tires?: Json | null
          vehicle_id: string
        }
        Update: {
          brakes?: Json | null
          certificate_expiry_date?: string | null
          certificate_issued_date?: string | null
          certificate_number?: string | null
          checklist?: Json
          compliance_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          defects_found?: string[] | null
          electrical_system?: Json | null
          engine_mechanical?: Json | null
          exterior_condition?: Json | null
          fluid_levels?: Json | null
          id?: string
          inspection_date?: string
          inspection_id?: string
          inspection_report_url?: string | null
          inspection_type?: string
          inspector_certification?: string | null
          inspector_id?: string | null
          inspector_name?: string
          interior_condition?: Json | null
          lights_signals?: Json | null
          meets_safety_standards?: boolean
          next_inspection_date?: string | null
          notes?: string | null
          odometer_reading?: number | null
          overall_status?: string
          photos?: Json | null
          priority_repairs?: string[] | null
          recommendations?: string | null
          reinspection_date?: string | null
          reinspection_required?: boolean | null
          roadworthy?: boolean
          safety_equipment?: Json | null
          tires?: Json | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlms_inspections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_maintenance_records: {
        Row: {
          actual_date: string | null
          category: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          invoices: Json | null
          issues_found: string | null
          labor_cost: number | null
          labor_hours: number | null
          maintenance_type: string
          mileage_at_service: number | null
          next_service_date: string | null
          next_service_mileage: number | null
          parts_cost: number | null
          parts_replaced: Json | null
          photos: Json | null
          priority: string | null
          recommendations: string | null
          record_id: string
          scheduled_date: string | null
          service_location: string | null
          service_provider: string | null
          status: string
          technician_name: string | null
          total_cost: number | null
          updated_at: string | null
          vehicle_id: string
          warranty_until: string | null
          work_order_number: string | null
        }
        Insert: {
          actual_date?: string | null
          category?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          invoices?: Json | null
          issues_found?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          maintenance_type: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          parts_cost?: number | null
          parts_replaced?: Json | null
          photos?: Json | null
          priority?: string | null
          recommendations?: string | null
          record_id: string
          scheduled_date?: string | null
          service_location?: string | null
          service_provider?: string | null
          status?: string
          technician_name?: string | null
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id: string
          warranty_until?: string | null
          work_order_number?: string | null
        }
        Update: {
          actual_date?: string | null
          category?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          invoices?: Json | null
          issues_found?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          maintenance_type?: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          parts_cost?: number | null
          parts_replaced?: Json | null
          photos?: Json | null
          priority?: string | null
          recommendations?: string | null
          record_id?: string
          scheduled_date?: string | null
          service_location?: string | null
          service_provider?: string | null
          status?: string
          technician_name?: string | null
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string
          warranty_until?: string | null
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_maintenance_records_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_vehicles: {
        Row: {
          acquisition_date: string
          acquisition_type: string
          cargo_capacity: number | null
          color: string | null
          created_at: string | null
          created_by: string | null
          current_assignment_type: string | null
          current_book_value: number | null
          current_driver_id: string | null
          current_location_id: string | null
          current_mileage: number | null
          depreciation_rate: number | null
          documents: Json | null
          engine_capacity: number | null
          fuel_type: string
          id: string
          insurance_expiry: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_inspection_date: string | null
          last_service_date: string | null
          license_plate: string
          make: string
          model: string
          next_inspection_date: string | null
          next_service_date: string | null
          notes: string | null
          photos: Json | null
          purchase_price: number | null
          registration_expiry: string | null
          seating_capacity: number | null
          status: string
          tags: string[] | null
          total_maintenance_cost: number | null
          transmission: string | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
          vehicle_type: string
          vendor_name: string | null
          vin: string | null
          warranty_expiry: string | null
          year: number
        }
        Insert: {
          acquisition_date: string
          acquisition_type: string
          cargo_capacity?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_assignment_type?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fuel_type: string
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          license_plate: string
          make: string
          model: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          photos?: Json | null
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: string
          tags?: string[] | null
          total_maintenance_cost?: number | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
          vehicle_type: string
          vendor_name?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          year: number
        }
        Update: {
          acquisition_date?: string
          acquisition_type?: string
          cargo_capacity?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_assignment_type?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fuel_type?: string
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          license_plate?: string
          make?: string
          model?: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          photos?: Json | null
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: string
          tags?: string[] | null
          total_maintenance_cost?: number | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
          vehicle_type?: string
          vendor_name?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vlms_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vlms_vehicles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inventory: {
        Row: {
          created_at: string
          id: string
          item_id: string
          node_id: string
          quantity: number
          reserved_qty: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          node_id: string
          quantity?: number
          reserved_qty?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          node_id?: string
          quantity?: number
          reserved_qty?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          activated_at: string | null
          address: string | null
          capabilities: Json
          capacity: number
          city: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          name: string
          operating_hours: string | null
          parent_id: string | null
          state: string | null
          storage_conditions: string[]
          storage_mode: string
          storage_zones: Json | null
          total_capacity_m3: number | null
          updated_at: string | null
          used_capacity_m3: number | null
          warehouse_type: string | null
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          address?: string | null
          capabilities?: Json
          capacity: number
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          operating_hours?: string | null
          parent_id?: string | null
          state?: string | null
          storage_conditions?: string[]
          storage_mode?: string
          storage_zones?: Json | null
          total_capacity_m3?: number | null
          updated_at?: string | null
          used_capacity_m3?: number | null
          warehouse_type?: string | null
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          address?: string | null
          capabilities?: Json
          capacity?: number
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          operating_hours?: string | null
          parent_id?: string | null
          state?: string | null
          storage_conditions?: string[]
          storage_mode?: string
          storage_zones?: Json | null
          total_capacity_m3?: number | null
          updated_at?: string | null
          used_capacity_m3?: number | null
          warehouse_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_countries: {
        Row: {
          country_id: string
          created_at: string
          id: string
          is_primary: boolean
          workspace_id: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          workspace_id: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_countries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_countries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_lgas: {
        Row: {
          admin_unit_id: string
          created_at: string
          id: string
          workspace_id: string
        }
        Insert: {
          admin_unit_id: string
          created_at?: string
          id?: string
          workspace_id: string
        }
        Update: {
          admin_unit_id?: string
          created_at?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_lgas_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "admin_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_lgas_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["lga_id"]
          },
          {
            foreignKeyName: "workspace_lgas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          role_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          role_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          role_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_readiness: {
        Row: {
          admin_configured_at: string | null
          became_ready_at: string | null
          created_at: string
          first_vehicle_at: string | null
          first_warehouse_at: string | null
          has_admin: boolean
          has_packaging_rules: boolean
          has_rbac_configured: boolean
          has_vehicle: boolean
          has_warehouse: boolean
          id: string
          is_ready: boolean | null
          packaging_configured_at: string | null
          rbac_configured_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          admin_configured_at?: string | null
          became_ready_at?: string | null
          created_at?: string
          first_vehicle_at?: string | null
          first_warehouse_at?: string | null
          has_admin?: boolean
          has_packaging_rules?: boolean
          has_rbac_configured?: boolean
          has_vehicle?: boolean
          has_warehouse?: boolean
          id?: string
          is_ready?: boolean | null
          packaging_configured_at?: string | null
          rbac_configured_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          admin_configured_at?: string | null
          became_ready_at?: string | null
          created_at?: string
          first_vehicle_at?: string | null
          first_warehouse_at?: string | null
          has_admin?: boolean
          has_packaging_rules?: boolean
          has_rbac_configured?: boolean
          has_vehicle?: boolean
          has_warehouse?: boolean
          id?: string
          is_ready?: boolean | null
          packaging_configured_at?: string | null
          rbac_configured_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_readiness_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          country: string
          created_at: string | null
          currency: string
          currency_symbol: string
          default_state: string | null
          id: string
          locale: string
          map_center_lat: number | null
          map_center_lng: number | null
          map_default_zoom: number | null
          metadata: Json | null
          timezone: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          country?: string
          created_at?: string | null
          currency?: string
          currency_symbol?: string
          default_state?: string | null
          id?: string
          locale?: string
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_default_zoom?: number | null
          metadata?: Json | null
          timezone?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          country?: string
          created_at?: string | null
          currency?: string
          currency_symbol?: string
          default_state?: string | null
          id?: string
          locale?: string
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_default_zoom?: number | null
          metadata?: Json | null
          timezone?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_states: {
        Row: {
          admin_unit_id: string
          created_at: string
          id: string
          workspace_id: string
        }
        Insert: {
          admin_unit_id: string
          created_at?: string
          id?: string
          workspace_id: string
        }
        Update: {
          admin_unit_id?: string
          created_at?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_states_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "admin_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_states_admin_unit_id_fkey"
            columns: ["admin_unit_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["lga_id"]
          },
          {
            foreignKeyName: "workspace_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          country_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          fax: string | null
          first_admin_assigned_at: string | null
          first_vehicle_added_at: string | null
          first_warehouse_added_at: string | null
          id: string
          is_active: boolean | null
          name: string
          onboarding_completed_at: string | null
          onboarding_current_step: string | null
          operating_model: string | null
          org_status: Database["public"]["Enums"]["org_status"]
          org_type: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          sector: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          country_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fax?: string | null
          first_admin_assigned_at?: string | null
          first_vehicle_added_at?: string | null
          first_warehouse_added_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          operating_model?: string | null
          org_status?: Database["public"]["Enums"]["org_status"]
          org_type?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          sector?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fax?: string | null
          first_admin_assigned_at?: string | null
          first_vehicle_added_at?: string | null
          first_warehouse_added_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          operating_model?: string | null
          org_status?: Database["public"]["Enums"]["org_status"]
          org_type?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          sector?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_alerts: {
        Row: {
          acknowledged: boolean | null
          driver_id: string
          event_type: string
          id: string
          location_lat: number
          location_lng: number
          notes: string | null
          timestamp: string | null
          zone_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          driver_id: string
          event_type: string
          id?: string
          location_lat: number
          location_lng: number
          notes?: string | null
          timestamp?: string | null
          zone_id: string
        }
        Update: {
          acknowledged?: boolean | null
          driver_id?: string
          event_type?: string
          id?: string
          location_lat?: number
          location_lng?: number
          notes?: string | null
          timestamp?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_alerts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_configurations: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          active: boolean
          assigned_facility_ids: string[] | null
          boundary: unknown
          capacity_limit: number | null
          centroid: unknown
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          description: string | null
          draft_created_at: string
          draft_created_by: string | null
          id: string
          metadata: Json | null
          name: string
          parent_version_id: string | null
          priority: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          target_delivery_time: number | null
          target_success_rate: number | null
          updated_at: string | null
          version: number
          workspace_id: string
          zone_type: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          active?: boolean
          assigned_facility_ids?: string[] | null
          boundary: unknown
          capacity_limit?: number | null
          centroid?: unknown
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          description?: string | null
          draft_created_at?: string
          draft_created_by?: string | null
          id?: string
          metadata?: Json | null
          name: string
          parent_version_id?: string | null
          priority?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_delivery_time?: number | null
          target_success_rate?: number | null
          updated_at?: string | null
          version?: number
          workspace_id: string
          zone_type?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          active?: boolean
          assigned_facility_ids?: string[] | null
          boundary?: unknown
          capacity_limit?: number | null
          centroid?: unknown
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          description?: string | null
          draft_created_at?: string
          draft_created_by?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          parent_version_id?: string | null
          priority?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_delivery_time?: number | null
          target_success_rate?: number | null
          updated_at?: string | null
          version?: number
          workspace_id?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_configurations_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "zone_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_configurations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          region_center: Json | null
          type: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
          zone_manager_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          region_center?: Json | null
          type?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
          zone_manager_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          region_center?: Json | null
          type?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
          zone_manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batch_slot_utilization: {
        Row: {
          batch_id: string | null
          facilities_assigned: number | null
          license_plate: string | null
          slot_utilization_pct: number | null
          slots_used: number | null
          total_load_kg: number | null
          total_load_m3: number | null
          vehicle_capacity_kg: number | null
          vehicle_capacity_m3: number | null
          vehicle_id: string | null
          vehicle_total_slots: number | null
          volume_utilization_pct: number | null
          weight_utilization_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      scheduler_overview_stats: {
        Row: {
          active_warehouses: number | null
          assigned_drivers: number | null
          assigned_vehicles: number | null
          avg_capacity: number | null
          cancelled_count: number | null
          published_count: number | null
          ready_count: number | null
          scheduled_count: number | null
          total_consignments: number | null
          total_distance: number | null
        }
        Relationships: []
      }
      slot_assignment_details: {
        Row: {
          batch_id: string | null
          batch_type: string | null
          created_at: string | null
          facility_address: string | null
          facility_id: string | null
          facility_name: string | null
          id: string | null
          load_kg: number | null
          load_volume_m3: number | null
          sequence_order: number | null
          slot_key: string | null
          slot_number: number | null
          status: string | null
          tier_name: string | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_license_plate: string | null
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_slot_availability: {
        Row: {
          license_plate: string | null
          occupancy_pct: number | null
          slots_available: number | null
          slots_occupied: number | null
          total_slots: number | null
          vehicle_id: string | null
        }
        Relationships: []
      }
      vehicle_tier_stats: {
        Row: {
          capacity_kg: number | null
          capacity_m3: number | null
          id: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          size_category: string | null
          tier_count: number | null
          tiered_config: Json | null
          total_slots: number | null
        }
        Insert: {
          capacity_kg?: number | null
          capacity_m3?: number | null
          id?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          size_category?: never
          tier_count?: never
          tiered_config?: Json | null
          total_slots?: number | null
        }
        Update: {
          capacity_kg?: number | null
          capacity_m3?: number | null
          id?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          size_category?: never
          tier_count?: never
          tiered_config?: Json | null
          total_slots?: number | null
        }
        Relationships: []
      }
      vehicles_unified_v: {
        Row: {
          acquisition_date: string | null
          acquisition_mode: string | null
          acquisition_type: string | null
          ai_capacity_image_url: string | null
          ai_generated: boolean | null
          avg_speed: number | null
          capacity: number | null
          capacity_kg: number | null
          capacity_m3: number | null
          capacity_volume_m3: number | null
          capacity_weight_kg: number | null
          category_id: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          current_book_value: number | null
          current_driver_id: string | null
          current_location_id: string | null
          current_mileage: number | null
          date_acquired: string | null
          depreciation_rate: number | null
          documents: Json | null
          engine_capacity: number | null
          fleet_id: string | null
          fuel_efficiency: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          gross_vehicle_weight_kg: number | null
          height_cm: number | null
          id: string | null
          insurance_expiry: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_inspection_date: string | null
          last_service_date: string | null
          legacy_metadata: Json | null
          length_cm: number | null
          license_plate: string | null
          make: string | null
          max_weight: number | null
          model: string | null
          next_inspection_date: string | null
          next_service_date: string | null
          notes: string | null
          number_of_axles: number | null
          number_of_wheels: number | null
          photo_uploaded_at: string | null
          photo_url: string | null
          photos: Json | null
          plate_number: string | null
          purchase_price: number | null
          registration_expiry: string | null
          seating_capacity: number | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
          tags: string[] | null
          telematics_id: string | null
          telematics_provider: string | null
          thumbnail_url: string | null
          tiered_config: Json | null
          total_maintenance_cost: number | null
          transmission: string | null
          updated_at: string | null
          updated_by: string | null
          vehicle_type_id: string | null
          vin: string | null
          warranty_expiry: string | null
          width_cm: number | null
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_mode?: string | null
          acquisition_type?: string | null
          ai_capacity_image_url?: string | null
          ai_generated?: boolean | null
          avg_speed?: number | null
          capacity?: number | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          capacity_volume_m3?: number | null
          capacity_weight_kg?: number | null
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          date_acquired?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fleet_id?: string | null
          fuel_efficiency?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          gross_vehicle_weight_kg?: number | null
          height_cm?: number | null
          id?: string | null
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          legacy_metadata?: Json | null
          length_cm?: number | null
          license_plate?: string | null
          make?: string | null
          max_weight?: number | null
          model?: string | null
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          number_of_axles?: number | null
          number_of_wheels?: number | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photos?: Json | null
          plate_number?: string | null
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
          tags?: string[] | null
          telematics_id?: string | null
          telematics_provider?: string | null
          thumbnail_url?: string | null
          tiered_config?: Json | null
          total_maintenance_cost?: number | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_type_id?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          width_cm?: number | null
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_mode?: string | null
          acquisition_type?: string | null
          ai_capacity_image_url?: string | null
          ai_generated?: boolean | null
          avg_speed?: number | null
          capacity?: number | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          capacity_volume_m3?: number | null
          capacity_weight_kg?: number | null
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          current_book_value?: number | null
          current_driver_id?: string | null
          current_location_id?: string | null
          current_mileage?: number | null
          date_acquired?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          engine_capacity?: number | null
          fleet_id?: string | null
          fuel_efficiency?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          gross_vehicle_weight_kg?: number | null
          height_cm?: number | null
          id?: string | null
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_inspection_date?: string | null
          last_service_date?: string | null
          legacy_metadata?: Json | null
          length_cm?: number | null
          license_plate?: string | null
          make?: string | null
          max_weight?: number | null
          model?: string | null
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          number_of_axles?: number | null
          number_of_wheels?: number | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photos?: Json | null
          plate_number?: string | null
          purchase_price?: number | null
          registration_expiry?: string | null
          seating_capacity?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
          tags?: string[] | null
          telematics_id?: string | null
          telematics_provider?: string | null
          thumbnail_url?: string | null
          tiered_config?: Json | null
          total_maintenance_cost?: number | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_type_id?: string | null
          vin?: string | null
          warranty_expiry?: string | null
          width_cm?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_with_taxonomy: {
        Row: {
          ai_capacity_image_url: string | null
          ai_generated: boolean | null
          avg_speed: number | null
          capacity: number | null
          capacity_kg: number | null
          capacity_m3: number | null
          capacity_volume_m3: number | null
          capacity_weight_kg: number | null
          category_code: string | null
          category_display_name: string | null
          category_id: string | null
          category_name: string | null
          category_source: string | null
          created_at: string | null
          current_driver_id: string | null
          fleet_id: string | null
          fuel_efficiency: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          height_cm: number | null
          id: string | null
          length_cm: number | null
          max_weight: number | null
          model: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          plate_number: string | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
          thumbnail_url: string | null
          tiered_config: Json | null
          type: string | null
          type_code: string | null
          type_default_capacity_kg: number | null
          type_default_capacity_m3: number | null
          type_name: string | null
          updated_at: string | null
          vehicle_type_id: string | null
          width_cm: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_with_tier_stats: {
        Row: {
          ai_capacity_image_url: string | null
          ai_generated: boolean | null
          avg_speed: number | null
          capacity: number | null
          capacity_kg: number | null
          capacity_m3: number | null
          capacity_volume_m3: number | null
          capacity_weight_kg: number | null
          category_id: string | null
          created_at: string | null
          current_driver_id: string | null
          fleet_id: string | null
          fuel_efficiency: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          height_cm: number | null
          id: string | null
          length_cm: number | null
          max_weight: number | null
          model: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          plate_number: string | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
          thumbnail_url: string | null
          tier_count: number | null
          tiered_config: Json | null
          total_tier_volume_m3: number | null
          total_tier_weight_kg: number | null
          type: string | null
          updated_at: string | null
          vehicle_type_id: string | null
          width_cm: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_active_assignments: {
        Row: {
          actual_return_date: string | null
          assigned_location_id: string | null
          assigned_location_name: string | null
          assigned_to_id: string | null
          assigned_to_name: string | null
          assignment_id: string | null
          assignment_letter_url: string | null
          assignment_type: string | null
          authorization_number: string | null
          authorized_by_id: string | null
          condition_end: string | null
          condition_start: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          fuel_level_end: number | null
          fuel_level_start: number | null
          id: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          photos_end: Json | null
          photos_start: Json | null
          project_name: string | null
          purpose: string | null
          return_checklist_url: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          vehicle_display_id: string | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vlms_assignments_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_authorized_by_id_fkey"
            columns: ["authorized_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_available_vehicles: {
        Row: {
          acquisition_date: string | null
          acquisition_type: string | null
          assignment_count: number | null
          cargo_capacity: number | null
          color: string | null
          created_at: string | null
          created_by: string | null
          current_assignment_type: string | null
          current_book_value: number | null
          current_driver_id: string | null
          current_location_id: string | null
          current_mileage: number | null
          depreciation_rate: number | null
          documents: Json | null
          engine_capacity: number | null
          fuel_type: string | null
          id: string | null
          incident_count: number | null
          insurance_expiry: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_inspection_date: string | null
          last_service_date: string | null
          license_plate: string | null
          maintenance_count: number | null
          make: string | null
          model: string | null
          next_inspection_date: string | null
          next_service_date: string | null
          notes: string | null
          photos: Json | null
          purchase_price: number | null
          registration_expiry: string | null
          seating_capacity: number | null
          status: string | null
          tags: string[] | null
          total_maintenance_cost: number | null
          transmission: string | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string | null
          vehicle_type: string | null
          vendor_name: string | null
          vin: string | null
          warranty_expiry: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_vehicles_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "zone_facility_hierarchy"
            referencedColumns: ["facility_id"]
          },
          {
            foreignKeyName: "vlms_vehicles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_overdue_maintenance: {
        Row: {
          actual_date: string | null
          category: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          days_overdue: number | null
          description: string | null
          id: string | null
          invoices: Json | null
          issues_found: string | null
          labor_cost: number | null
          labor_hours: number | null
          license_plate: string | null
          maintenance_type: string | null
          make: string | null
          mileage_at_service: number | null
          model: string | null
          next_service_date: string | null
          next_service_mileage: number | null
          parts_cost: number | null
          parts_replaced: Json | null
          photos: Json | null
          priority: string | null
          recommendations: string | null
          record_id: string | null
          scheduled_date: string | null
          service_location: string | null
          service_provider: string | null
          status: string | null
          technician_name: string | null
          total_cost: number | null
          updated_at: string | null
          vehicle_display_id: string | null
          vehicle_id: string | null
          warranty_until: string | null
          work_order_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_maintenance_records_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_upcoming_maintenance: {
        Row: {
          actual_date: string | null
          category: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          current_mileage: number | null
          description: string | null
          id: string | null
          invoices: Json | null
          issues_found: string | null
          labor_cost: number | null
          labor_hours: number | null
          license_plate: string | null
          maintenance_type: string | null
          make: string | null
          mileage_at_service: number | null
          model: string | null
          next_service_date: string | null
          next_service_mileage: number | null
          parts_cost: number | null
          parts_replaced: Json | null
          photos: Json | null
          priority: string | null
          recommendations: string | null
          record_id: string | null
          scheduled_date: string | null
          service_location: string | null
          service_provider: string | null
          status: string | null
          technician_name: string | null
          total_cost: number | null
          updated_at: string | null
          vehicle_display_id: string | null
          vehicle_id: string | null
          warranty_until: string | null
          work_order_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vlms_maintenance_records_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_slot_availability"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_unified_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_tier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlms_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vlms_vehicles_with_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      vlms_vehicles_with_taxonomy: {
        Row: {
          ai_capacity_image_url: string | null
          ai_generated: boolean | null
          avg_speed: number | null
          capacity: number | null
          capacity_volume_m3: number | null
          capacity_weight_kg: number | null
          category_code: string | null
          category_name: string | null
          category_source: string | null
          created_at: string | null
          current_driver_id: string | null
          fleet_id: string | null
          fuel_efficiency: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          id: string | null
          max_weight: number | null
          model: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          plate_number: string | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
          thumbnail_url: string | null
          type: string | null
          type_code: string | null
          type_display_name: string | null
          type_name: string | null
          updated_at: string | null
          vehicle_type_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_readiness_details: {
        Row: {
          admin_configured_at: string | null
          became_ready_at: string | null
          first_vehicle_at: string | null
          first_warehouse_at: string | null
          has_admin: boolean | null
          has_packaging_rules: boolean | null
          has_rbac_configured: boolean | null
          has_vehicle: boolean | null
          has_warehouse: boolean | null
          is_ready: boolean | null
          missing_items: string[] | null
          org_status: Database["public"]["Enums"]["org_status"] | null
          progress_percentage: number | null
          updated_at: string | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_readiness_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_facility_hierarchy: {
        Row: {
          facility_id: string | null
          facility_lat: number | null
          facility_lng: number | null
          facility_name: string | null
          facility_type: Database["public"]["Enums"]["facility_type"] | null
          lga_id: string | null
          lga_name: string | null
          warehouse_id: string | null
          warehouse_name: string | null
          zone_code: string | null
          zone_id: string | null
          zone_name: string | null
        }
        Relationships: []
      }
      zone_metrics: {
        Row: {
          created_at: string | null
          facility_count: number | null
          fleet_count: number | null
          is_active: boolean | null
          lga_count: number | null
          updated_at: string | null
          warehouse_count: number | null
          zone_code: string | null
          zone_id: string | null
          zone_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      activate_warehouse: { Args: { p_warehouse_id: string }; Returns: boolean }
      activate_zone_configuration: {
        Args: { p_activated_by: string; p_zone_id: string }
        Returns: boolean
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_bulk_set_user_permissions: {
        Args: { _permission_ids: string[]; _target_user_id: string }
        Returns: undefined
      }
      admin_copy_user_permissions: {
        Args: {
          _copy_direct?: boolean
          _copy_groups?: boolean
          _copy_role?: boolean
          _source_user_id: string
          _target_user_id: string
        }
        Returns: Json
      }
      admin_get_user_effective_permissions: {
        Args: { _target_user_id: string }
        Returns: {
          action: string
          category: string
          description: string
          is_dangerous: boolean
          permission_code: string
          permission_id: string
          resource: string
          source: string
          source_name: string
        }[]
      }
      admin_set_group_permissions: {
        Args: { _group_id: string; _permission_ids: string[] }
        Returns: undefined
      }
      admin_set_user_permission: {
        Args: {
          _grant: boolean
          _permission_id: string
          _target_user_id: string
        }
        Returns: undefined
      }
      advance_org_status: {
        Args: { p_workspace_id: string }
        Returns: Database["public"]["Enums"]["org_status"]
      }
      allocate_inventory: {
        Args: {
          p_item_id: string
          p_node_id: string
          p_quantity: number
          p_workspace_id: string
        }
        Returns: Json
      }
      archive_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      assign_driver_to_batch: {
        Args: { p_batch_id: string; p_driver_id: string }
        Returns: boolean
      }
      assign_requisitions_to_batch: {
        Args: { p_batch_id: string; p_requisition_ids: string[] }
        Returns: number
      }
      assign_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      build_batch_snapshot: { Args: { p_batch_id: string }; Returns: Json }
      bulk_insert_facilities: {
        Args: { facilities: Json }
        Returns: {
          error_message: string
          failed_count: number
          inserted_count: number
        }[]
      }
      calculate_cargo_volume: {
        Args: { height_cm: number; length_cm: number; width_cm: number }
        Returns: number
      }
      calculate_vehicle_fuel_efficiency: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_vehicle_id: string
        }
        Returns: number
      }
      can_access_planning: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      cleanup_expired_email_otps: { Args: never; Returns: number }
      cleanup_expired_scopes: { Args: never; Returns: number }
      cleanup_old_audit_logs: {
        Args: { _retention_days?: number }
        Returns: number
      }
      complete_dispatch: { Args: { p_batch_id: string }; Returns: boolean }
      complete_driver_activation: {
        Args: {
          p_device_id: string
          p_device_name?: string
          p_display_name?: string
          p_pin: string
          p_platform?: string
          p_user_agent?: string
        }
        Returns: boolean
      }
      complete_onboarding: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      compute_requisition_packaging: {
        Args: { p_requisition_id: string }
        Returns: string
      }
      compute_total_slots: { Args: { config: Json }; Returns: number }
      create_audit_log: {
        Args: {
          _action: string
          _metadata?: Json
          _new_state?: Json
          _previous_state?: Json
          _resource: string
          _resource_id: string
          _severity?: string
        }
        Returns: string
      }
      create_organization_with_admin: {
        Args: {
          p_country_id: string
          p_country_ids?: string[]
          p_fax?: string
          p_name: string
          p_operating_model?: string
          p_org_type?: string
          p_primary_contact_email?: string
          p_primary_contact_name?: string
          p_primary_contact_phone?: string
          p_sector?: string
          p_slug: string
        }
        Returns: string
      }
      create_workspace: {
        Args: {
          p_country_id?: string
          p_name: string
          p_org_type?: string
          p_slug: string
        }
        Returns: string
      }
      deactivate_warehouse: {
        Args: { p_warehouse_id: string }
        Returns: boolean
      }
      determine_packaging_type: {
        Args: { p_volume_m3: number; p_weight_kg: number }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dispatch_transfer: { Args: { p_transfer_id: string }; Returns: boolean }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      end_driver_session: {
        Args: { p_end_reason?: string; p_session_id: string }
        Returns: boolean
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_stale_sessions: { Args: never; Returns: number }
      find_admin_unit_by_point: {
        Args: {
          p_admin_level?: number
          p_country_id?: string
          p_lat: number
          p_lng: number
        }
        Returns: {
          admin_level: number
          country_id: string
          id: string
          name: string
        }[]
      }
      fuzzy_match_admin_unit: {
        Args: {
          p_admin_level?: number
          p_country_id: string
          p_name: string
          p_threshold?: number
        }
        Returns: {
          admin_level: number
          id: string
          name: string
          similarity: number
        }[]
      }
      generate_email_login_otp: { Args: { p_email: string }; Returns: Json }
      generate_mod4_otp: {
        Args: { p_email: string; p_workspace_id: string }
        Returns: string
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_drivers_with_positions: {
        Args: never
        Returns: {
          batch_name: string
          battery_level: number
          current_batch_id: string
          current_lat: number
          current_lng: number
          driver_id: string
          driver_name: string
          heading: number
          last_update: string
          session_id: string
          session_started_at: string
          speed_mps: number
          vehicle_id: string
          vehicle_plate: string
        }[]
      }
      get_active_zones: {
        Args: { p_workspace_id: string }
        Returns: {
          activated_at: string
          boundary: unknown
          centroid: unknown
          id: string
          name: string
          version: number
          zone_type: string
        }[]
      }
      get_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_admin_unit_descendants: {
        Args: { unit_id: string }
        Returns: {
          admin_level: number
          depth: number
          id: string
          name: string
        }[]
      }
      get_admin_user_by_id: { Args: { p_user_id: string }; Returns: Json }
      get_admin_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role_filter?: string[]
          p_search?: string
        }
        Returns: Json
      }
      get_batch_slot_assignments: {
        Args: { p_batch_id: string }
        Returns: {
          facility_id: string
          facility_name: string
          load_kg: number
          sequence_order: number
          slot_key: string
          slot_number: number
          tier_name: string
        }[]
      }
      get_batch_slot_demand: {
        Args: { p_facility_ids: string[] }
        Returns: {
          facility_id: string
          facility_name: string
          requisition_count: number
          slot_demand: number
        }[]
      }
      get_batch_warehouse_h3_coverage: {
        Args: {
          p_radius: number
          p_resolution: number
          p_warehouse_ids: string[]
        }
        Returns: {
          capacity_remaining: number
          cells: string[]
          facilities_covered: number
          total_demand: number
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      get_cost_by_program: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          cost_per_delivery: number
          cost_per_item: number
          cost_per_km: number
          estimated_fuel_cost: number
          programme: string
          total_deliveries: number
          total_distance_km: number
          total_items_delivered: number
        }[]
      }
      get_cost_kpis: {
        Args: never
        Returns: {
          active_drivers: number
          active_vehicles: number
          avg_cost_per_item: number
          avg_cost_per_km: number
          total_fuel_cost: number
          total_items_delivered: number
          total_maintenance_cost: number
          total_system_cost: number
        }[]
      }
      get_dashboard_summary: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          active_drivers: number
          active_vehicles: number
          avg_completion_hours: number
          cost_per_item: number
          cost_per_km: number
          driver_on_time_rate: number
          on_time_rate: number
          total_cost: number
          total_deliveries: number
          total_incidents: number
          total_items: number
          vehicle_utilization_rate: number
          vehicles_in_maintenance: number
        }[]
      }
      get_delivery_kpis: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_completion_time_hours: number
          completed_batches: number
          late_batches: number
          on_time_batches: number
          on_time_rate: number
          total_batches: number
          total_distance_km: number
          total_items_delivered: number
        }[]
      }
      get_driver_costs: {
        Args: { limit_count?: number }
        Returns: {
          cost_per_item: number
          distance_covered: number
          driver_id: string
          fuel_cost: number
          items_delivered: number
          operational_cost: number
          total_cost: number
        }[]
      }
      get_driver_devices: {
        Args: { p_workspace_id: string }
        Returns: {
          device_id: string
          device_name: string
          id: string
          is_trusted: boolean
          last_seen_at: string
          platform: string
          registered_at: string
          revoked_at: string
          user_email: string
          user_id: string
        }[]
      }
      get_driver_event_timeline: {
        Args: { p_driver_id: string; p_limit?: number; p_session_id?: string }
        Returns: {
          batch_name: string
          captured_at: string
          event_id: string
          event_type: string
          lat: number
          lng: number
          metadata: Json
        }[]
      }
      get_driver_kpis: {
        Args: never
        Returns: {
          active_drivers: number
          avg_fuel_efficiency: number
          avg_on_time_rate: number
          total_drivers: number
          total_incidents: number
        }[]
      }
      get_driver_utilization: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_deliveries_per_week: number
          avg_items_per_delivery: number
          driver_id: string
          driver_name: string
          total_deliveries: number
          total_distance_km: number
          total_items_delivered: number
          utilization_status: string
        }[]
      }
      get_driver_vehicles: {
        Args: { p_driver_id: string }
        Returns: {
          ai_generated: boolean
          assigned_at: string
          avg_speed: number
          capacity: number
          fuel_type: string
          is_current: boolean
          model: string
          photo_url: string
          plate_number: string
          thumbnail_url: string
          total_trips: number
          type: string
          vehicle_id: string
        }[]
      }
      get_effective_permissions: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: {
          category: string
          description: string
          granted: boolean
          permission_code: string
          permission_id: string
          source: string
        }[]
      }
      get_event_distribution: {
        Args: { p_days?: number }
        Returns: {
          count: number
          event_type: string
        }[]
      }
      get_facility_coverage: {
        Args: {
          p_end_date?: string
          p_programme?: string
          p_start_date?: string
        }
        Returns: {
          coverage_pct: number
          facilities_not_served: number
          facilities_served: number
          program_coverage_pct: number
          program_facilities_served: number
          program_total_facilities: number
          programme: string
          total_facilities: number
          unserved_facility_names: string[]
        }[]
      }
      get_facility_slot_demand: {
        Args: { p_facility_id: string }
        Returns: number
      }
      get_fleetops_dispatch_analytics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_funding_source_id: { Args: { source_code: string }; Returns: string }
      get_h3_cell_metrics: {
        Args: {
          p_end_date?: string
          p_h3_indexes: string[]
          p_resolution: number
          p_start_date?: string
        }
        Returns: {
          active_facilities: number
          active_warehouses: number
          capacity_available: number
          capacity_utilized: number
          deliveries: number
          demand_forecast: number
          h3_index: string
          resolution: number
          sla_at_risk: number
          sla_breach_pct: number
          utilization_pct: number
        }[]
      }
      get_h3_region_metrics: {
        Args: {
          p_end_date?: string
          p_h3_indexes: string[]
          p_start_date?: string
        }
        Returns: {
          avg_utilization: number
          facilities_count: number
          sla_at_risk_count: number
          total_deliveries: number
          total_demand: number
          warehouses_count: number
        }[]
      }
      get_implementing_partner_id: {
        Args: { partner_code: string }
        Returns: string
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      get_low_stock_alerts: {
        Args: { p_threshold_days?: number }
        Returns: {
          current_quantity: number
          days_supply_remaining: number
          facility_id: string
          facility_name: string
          last_delivery_date: string
          product_name: string
          zone: string
        }[]
      }
      get_map_data_in_view: {
        Args: {
          _workspace_id: string
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          zoom_level: number
        }
        Returns: Json
      }
      get_mod4_linked_users: {
        Args: { p_workspace_id: string }
        Returns: {
          driver_id: string
          id: string
          link_method: string
          linked_at: string
          linked_by: string
          linked_by_name: string
          status: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_my_workspaces: {
        Args: never
        Returns: {
          name: string
          role_code: string
          role_name: string
          slug: string
          workspace_id: string
        }[]
      }
      get_packaging_type_distribution: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_slot_cost_per_item: number
          avg_slot_demand_per_requisition: number
          item_count: number
          packaging_type: string
          requisition_count: number
          total_package_count: number
          total_quantity: number
          total_slot_cost: number
        }[]
      }
      get_program_metrics: {
        Args: { _program_code: string; _workspace_id: string }
        Returns: Json
      }
      get_program_performance: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_items_per_delivery: number
          late_deliveries: number
          on_time_deliveries: number
          on_time_rate_pct: number
          programme: string
          total_deliveries: number
          total_facilities_served: number
          total_items_delivered: number
        }[]
      }
      get_programme_category_id: {
        Args: { programme_name: string }
        Returns: string
      }
      get_route_efficiency: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          actual_distance_km: number
          actual_duration_min: number
          batch_id: string
          batch_name: string
          distance_variance_pct: number
          efficiency_rating: string
          estimated_distance_km: number
          estimated_duration_min: number
          route_date: string
          time_variance_pct: number
        }[]
      }
      get_session_activity: {
        Args: { p_days?: number }
        Returns: {
          count: number
          date: string
        }[]
      }
      get_session_gps_quality: { Args: { p_session_id: string }; Returns: Json }
      get_stock_balance: {
        Args: { p_product_name?: string }
        Returns: {
          allocated_quantity: number
          available_quantity: number
          facilities_count: number
          product_name: string
          total_quantity: number
        }[]
      }
      get_stock_by_zone: {
        Args: never
        Returns: {
          facilities_count: number
          low_stock_facilities: number
          total_products: number
          total_quantity: number
          zone: string
        }[]
      }
      get_stock_performance: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_days_supply: number
          current_stock: number
          product_name: string
          total_delivered: number
          turnover_rate: number
        }[]
      }
      get_stock_status: {
        Args: never
        Returns: {
          low_stock_count: number
          out_of_stock_count: number
          total_facilities_with_stock: number
          total_products: number
          total_stock_items: number
        }[]
      }
      get_storefront_requisition_analytics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_top_drivers: {
        Args: { limit_count?: number; metric?: string }
        Returns: {
          completed_batches: number
          driver_id: string
          driver_name: string
          fuel_efficiency_km_per_liter: number
          on_time_rate: number
          total_incidents: number
          total_items_delivered: number
        }[]
      }
      get_top_vehicles_by_ontime: {
        Args: { limit_count?: number }
        Returns: {
          on_time_batches: number
          on_time_rate: number
          total_batches: number
          vehicle_id: string
          vehicle_number: string
          vehicle_type: string
        }[]
      }
      get_user_admin_workspace_ids: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      get_user_emails: { Args: { p_user_ids: string[] }; Returns: Json }
      get_user_growth: {
        Args: { p_days?: number }
        Returns: {
          count: number
          date: string
        }[]
      }
      get_user_onboarding_status: { Args: never; Returns: Json }
      get_user_organization: { Args: never; Returns: string }
      get_user_program_scopes: {
        Args: { _user_id: string }
        Returns: {
          program_id: string
        }[]
      }
      get_user_warehouse_scopes: {
        Args: { _user_id: string }
        Returns: {
          warehouse_id: string
        }[]
      }
      get_user_workspace_ids: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      get_user_workspace_ids_array: { Args: never; Returns: string[] }
      get_users_with_roles: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role_filter?: string[]
          p_search?: string
        }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          phone: string
          roles: string[]
          user_id: string
          workspace_count: number
        }[]
      }
      get_vehicle_costs: {
        Args: { limit_count?: number }
        Returns: {
          fuel_consumed_liters: number
          fuel_cost: number
          maintenance_cost: number
          maintenance_events: number
          total_cost: number
          vehicle_id: string
        }[]
      }
      get_vehicle_kpis: {
        Args: never
        Returns: {
          active_vehicles: number
          avg_fuel_efficiency: number
          avg_utilization_rate: number
          in_maintenance: number
          total_maintenance_cost: number
          total_vehicles: number
        }[]
      }
      get_vehicle_payload_utilization: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_vehicle_id?: string
        }
        Returns: {
          avg_payload_utilization_pct: number
          avg_weight_utilization_pct: number
          max_payload_utilization_pct: number
          max_weight_kg: number
          max_weight_utilization_pct: number
          plate_number: string
          total_deliveries: number
          total_items_delivered: number
          total_weight_kg: number
          underutilized_deliveries: number
          vehicle_capacity_kg: number
          vehicle_id: string
          vehicle_type: string
        }[]
      }
      get_vehicles_needing_maintenance: {
        Args: never
        Returns: {
          last_maintenance_date: string
          maintenance_in_progress: number
          plate_number: string
          total_distance_km: number
          total_maintenance_cost: number
          vehicle_id: string
          vehicle_type: string
        }[]
      }
      get_warehouse_h3_coverage: {
        Args: { p_radius: number; p_resolution: number; p_warehouse_id: string }
        Returns: {
          capacity_remaining: number
          cells: string[]
          facilities_covered: number
          total_demand: number
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      get_workspace_permissions: {
        Args: { p_workspace_id: string }
        Returns: {
          permission_code: string
        }[]
      }
      get_workspace_readiness: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      get_workspace_role: { Args: { p_workspace_id: string }; Returns: string }
      get_workspace_tradeoffs: {
        Args: { p_workspace_id: string }
        Returns: {
          estimated_time_saved: number
          handover_point: unknown
          id: string
          initiated_at: string
          items_count: number
          receiving_vehicle_ids: string[]
          source_vehicle_id: string
          status: string
        }[]
      }
      get_zone_summary: {
        Args: { zone_uuid: string }
        Returns: {
          active_dispatches: number
          facility_count: number
          fleet_count: number
          lga_count: number
          warehouse_count: number
          zone_name: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      ingest_gps_events: {
        Args: { events: Json }
        Returns: {
          errors: Json
          failed_count: number
          inserted_count: number
        }[]
      }
      insert_mod4_event: {
        Args: {
          p_batch_id?: string
          p_captured_at: string
          p_device_id: string
          p_dispatch_id?: string
          p_driver_id: string
          p_event_type: string
          p_lat: number
          p_lng: number
          p_metadata?: Json
          p_session_id: string
          p_trip_id?: string
          p_vehicle_id?: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_slot_available: {
        Args: { p_batch_id?: string; p_slot_key: string; p_vehicle_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: never; Returns: boolean }
      is_workspace_admin: {
        Args: { p_user_id?: string; p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { p_user_id?: string; p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_v2: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { p_user_id?: string; p_workspace_id: string }
        Returns: boolean
      }
      link_user_to_mod4: {
        Args: {
          p_link_method?: string
          p_user_id: string
          p_workspace_id?: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_requisition_ready_for_dispatch: {
        Args: { p_requisition_id: string }
        Returns: boolean
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      receive_transfer: {
        Args: { p_items: Json; p_transfer_id: string }
        Returns: string
      }
      refresh_user_permissions_fn: { Args: never; Returns: undefined }
      release_reservation: {
        Args: {
          p_item_id: string
          p_node_id: string
          p_quantity: number
          p_workspace_id: string
        }
        Returns: boolean
      }
      remove_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      reset_member_overrides: {
        Args: { p_member_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: boolean }
      save_member_overrides: {
        Args: {
          p_grant_ids: string[]
          p_member_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      save_onboarding_step: {
        Args: { p_step: string; p_workspace_id: string }
        Returns: undefined
      }
      save_workspace_lgas: {
        Args: { p_admin_unit_ids: string[]; p_workspace_id: string }
        Returns: undefined
      }
      save_workspace_states: {
        Args: { p_admin_unit_ids: string[]; p_workspace_id: string }
        Returns: undefined
      }
      search_users_for_workspace_invite: {
        Args: { p_search?: string; p_workspace_id: string }
        Returns: Json
      }
      shares_workspace_with_caller: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      start_dispatch: { Args: { p_batch_id: string }; Returns: boolean }
      start_driver_session: {
        Args: {
          p_device_id: string
          p_device_info?: Json
          p_driver_id: string
          p_start_lat?: number
          p_start_lng?: number
          p_vehicle_id?: string
        }
        Returns: string
      }
      submit_onboarding_request: {
        Args: {
          p_device_id?: string
          p_email?: string
          p_full_name: string
          p_organization_hint?: string
          p_phone?: string
        }
        Returns: string
      }
      sync_vehicle_tiers_from_config: {
        Args: { p_tier_config: Json; p_vehicle_id: string }
        Returns: undefined
      }
      toggle_member_status: {
        Args: {
          p_member_user_id: string
          p_status: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_member_role_v2: {
        Args: {
          p_member_user_id: string
          p_role_code: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      update_session_heartbeat: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      update_workspace_config: {
        Args: {
          p_operating_model?: string
          p_primary_contact_email?: string
          p_primary_contact_name?: string
          p_primary_contact_phone?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      update_workspace_general_settings: {
        Args: {
          p_name: string
          p_org_type?: string
          p_settings?: Json
          p_workspace_id: string
        }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      user_has_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      validate_driver_device: {
        Args: { p_device_id: string }
        Returns: boolean
      }
      validate_slot_count: { Args: { slot_count: number }; Returns: boolean }
      validate_tier_config: {
        Args: { p_tiered_config: Json }
        Returns: boolean
      }
      validate_tiered_config: { Args: { config: Json }; Returns: boolean }
      vendor_has_role: {
        Args: {
          role: Database["public"]["Enums"]["vendor_role"]
          vendor_roles: Database["public"]["Enums"]["vendor_role"][]
        }
        Returns: boolean
      }
      verify_email_login_otp: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
      verify_mod4_otp: {
        Args: { p_email: string; p_otp: string }
        Returns: string
      }
    }
    Enums: {
      batch_status:
        | "planned"
        | "assigned"
        | "in-progress"
        | "completed"
        | "cancelled"
      delivery_priority: "low" | "medium" | "high" | "urgent"
      driver_status:
        | "INACTIVE"
        | "ACTIVE"
        | "EN_ROUTE"
        | "AT_STOP"
        | "DELAYED"
        | "COMPLETED"
        | "SUSPENDED"
      event_type:
        | "ROUTE_STARTED"
        | "ARRIVED_AT_STOP"
        | "DEPARTED_STOP"
        | "PROOF_CAPTURED"
        | "DELAY_REPORTED"
        | "ROUTE_COMPLETED"
        | "ROUTE_CANCELLED"
        | "SUPERVISOR_OVERRIDE"
      facility_type:
        | "hospital"
        | "clinic"
        | "health_center"
        | "pharmacy"
        | "lab"
        | "other"
        | "warehouse"
      fuel_type: "diesel" | "petrol" | "electric"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      license_type: "standard" | "commercial"
      optimization_status: "pending" | "running" | "completed" | "failed"
      org_status:
        | "org_created"
        | "admin_assigned"
        | "basic_config_complete"
        | "operational_config_complete"
        | "active"
      organization_type:
        | "government_agency"
        | "ngo_ingo"
        | "private_company"
        | "logistics_provider"
        | "healthcare_facility"
        | "donor_development_partner"
        | "other"
      packaging_type: "bag_s" | "box_m" | "box_l" | "crate_xl"
      scheduler_batch_status:
        | "draft"
        | "ready"
        | "scheduled"
        | "published"
        | "cancelled"
      scheduling_mode: "manual" | "ai_optimized" | "uploaded" | "template"
      tradeoff_status:
        | "initiated"
        | "receivers_selected"
        | "allocation_complete"
        | "confirmations_pending"
        | "all_confirmed"
        | "executed"
        | "cancelled"
      user_status: "invited" | "registered" | "role_assigned" | "active"
      vehicle_status: "available" | "in-use" | "maintenance"
      vehicle_type: "truck" | "van" | "pickup" | "car"
      vendor_role: "client" | "partner" | "service_vendor"
      vendor_service:
        | "fleet_vehicles"
        | "drivers"
        | "warehousing"
        | "last_mile_delivery"
        | "cold_chain_logistics"
        | "maintenance_fuel"
        | "other"
      vendor_status: "active" | "suspended" | "archived"
      warehouse_type: "central" | "zonal" | "regional"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      batch_status: [
        "planned",
        "assigned",
        "in-progress",
        "completed",
        "cancelled",
      ],
      delivery_priority: ["low", "medium", "high", "urgent"],
      driver_status: [
        "INACTIVE",
        "ACTIVE",
        "EN_ROUTE",
        "AT_STOP",
        "DELAYED",
        "COMPLETED",
        "SUSPENDED",
      ],
      event_type: [
        "ROUTE_STARTED",
        "ARRIVED_AT_STOP",
        "DEPARTED_STOP",
        "PROOF_CAPTURED",
        "DELAY_REPORTED",
        "ROUTE_COMPLETED",
        "ROUTE_CANCELLED",
        "SUPERVISOR_OVERRIDE",
      ],
      facility_type: [
        "hospital",
        "clinic",
        "health_center",
        "pharmacy",
        "lab",
        "other",
        "warehouse",
      ],
      fuel_type: ["diesel", "petrol", "electric"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      license_type: ["standard", "commercial"],
      optimization_status: ["pending", "running", "completed", "failed"],
      org_status: [
        "org_created",
        "admin_assigned",
        "basic_config_complete",
        "operational_config_complete",
        "active",
      ],
      organization_type: [
        "government_agency",
        "ngo_ingo",
        "private_company",
        "logistics_provider",
        "healthcare_facility",
        "donor_development_partner",
        "other",
      ],
      packaging_type: ["bag_s", "box_m", "box_l", "crate_xl"],
      scheduler_batch_status: [
        "draft",
        "ready",
        "scheduled",
        "published",
        "cancelled",
      ],
      scheduling_mode: ["manual", "ai_optimized", "uploaded", "template"],
      tradeoff_status: [
        "initiated",
        "receivers_selected",
        "allocation_complete",
        "confirmations_pending",
        "all_confirmed",
        "executed",
        "cancelled",
      ],
      user_status: ["invited", "registered", "role_assigned", "active"],
      vehicle_status: ["available", "in-use", "maintenance"],
      vehicle_type: ["truck", "van", "pickup", "car"],
      vendor_role: ["client", "partner", "service_vendor"],
      vendor_service: [
        "fleet_vehicles",
        "drivers",
        "warehousing",
        "last_mile_delivery",
        "cold_chain_logistics",
        "maintenance_fuel",
        "other",
      ],
      vendor_status: ["active", "suspended", "archived"],
      warehouse_type: ["central", "zonal", "regional"],
    },
  },
} as const
