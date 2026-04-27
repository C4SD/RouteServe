/**
 * Import OSM Administrative Boundaries Edge Function
 *
 * This Supabase Edge Function downloads OSM admin boundaries from Geofabrik
 * and imports them into the admin_units table.
 *
 * It runs as a background job and emits progress via Supabase Realtime.
 *
 * Usage:
 *   POST /functions/v1/import-boundaries
 *   Body: {
 *     "region": "nigeria",
 *     "adminLevels": [4, 6, 8],  // States, LGAs, Wards
 *     "countryId": "00000000-0000-0000-0000-000000000001",
 *     "workspaceId": "00000000-0000-0000-0000-000000000002"
 *   }
 *
 * Response: { "jobId": "uuid", "status": "started" }
 *
 * Progress updates are broadcast via Supabase Realtime on channel `boundary-import:${jobId}`
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEOFABRIK_REGIONS: Record<string, string> = {
  nigeria: 'https://download.geofabrik.de/africa/nigeria-latest.geojson',
};

const NIGERIA_ADMIN_LEVELS = {
  COUNTRY: 2,
  STATE: 4,
  LGA: 6,
  WARD: 8,
};

interface ImportRequest {
  region: string;
  adminLevels: number[];
  countryId: string;
  workspaceId?: string;
}

interface AdminBoundary {
  osmId: string;
  osmType: string;
  adminLevel: number;
  name: string;
  nameEn?: string;
  geometry: any;
  center: { lat: number; lng: number };
  tags: Record<string, any>;
  population?: number;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Parse request
    const { region, adminLevels, countryId, workspaceId }: ImportRequest = await req.json();

    // Validate request
    if (!region || !GEOFABRIK_REGIONS[region]) {
      return new Response(
        JSON.stringify({ error: 'Invalid region' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!countryId) {
      return new Response(
        JSON.stringify({ error: 'countryId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const levelsToImport = adminLevels || [4, 6, 8]; // Default: States, LGAs, Wards

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate job ID
    const jobId = crypto.randomUUID();

    // Start import process (don't await - let it run in background)
    importBoundaries(supabase, jobId, region, levelsToImport, countryId, workspaceId);

    return new Response(
      JSON.stringify({
        jobId,
        status: 'started',
        message: `Import started for ${region}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error starting import:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

/**
 * Background import process
 */
async function importBoundaries(
  supabase: any,
  jobId: string,
  region: string,
  adminLevels: number[],
  countryId: string,
  workspaceId?: string
): Promise<void> {
  const channelName = `boundary-import:${jobId}`;

  try {
    // Emit progress: Downloading
    await broadcastProgress(supabase, channelName, {
      status: 'downloading',
      message: `Downloading ${region} boundaries from Geofabrik...`,
      progress: 10,
    });

    const geoJsonUrl = GEOFABRIK_REGIONS[region];
    const response = await fetch(geoJsonUrl);

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    // Emit progress: Parsing
    await broadcastProgress(supabase, channelName, {
      status: 'parsing',
      message: 'Parsing GeoJSON data...',
      progress: 30,
    });

    const geojson = await response.json();

    // Extract boundaries
    const boundaries: AdminBoundary[] = [];

    for (const feature of geojson.features) {
      const props = feature.properties || {};
      const adminLevel = parseInt(props.admin_level || '0', 10);

      if (
        adminLevels.includes(adminLevel) &&
        props.boundary === 'administrative' &&
        props.name
      ) {
        const center = calculateCentroid(feature.geometry);

        boundaries.push({
          osmId: props.id || props['@id'] || feature.id?.toString() || '',
          osmType: props['@type'] || 'relation',
          adminLevel,
          name: props.name,
          nameEn: props['name:en'],
          geometry: feature.geometry,
          center,
          tags: props,
          population: parseInt(props.population || '0', 10) || undefined,
        });
      }
    }

    // Emit progress: Importing
    await broadcastProgress(supabase, channelName, {
      status: 'importing',
      message: `Importing ${boundaries.length} boundaries...`,
      progress: 50,
      totalBoundaries: boundaries.length,
    });

    // Import boundaries in batches
    const BATCH_SIZE = 50;
    let imported = 0;

    for (let i = 0; i < boundaries.length; i += BATCH_SIZE) {
      const batch = boundaries.slice(i, i + BATCH_SIZE);

      // Build insert data
      const records = batch.map((b) => ({
        country_id: countryId,
        workspace_id: workspaceId || null,
        parent_id: null, // Will be set later via spatial queries
        osm_id: b.osmId,
        osm_type: b.osmType,
        admin_level: b.adminLevel,
        name: b.name,
        name_en: b.nameEn,
        geometry: JSON.stringify(b.geometry), // PostGIS will parse GeoJSON
        center_point: `POINT(${b.center.lng} ${b.center.lat})`,
        population: b.population,
        metadata: b.tags,
        is_active: true,
      }));

      // Insert batch — conflict target matches the constraint added in migration
      // 20260426000003 (osm_id, country_id, workspace_id).
      const { error } = await supabase
        .from('admin_units')
        .upsert(records, { onConflict: 'osm_id,country_id,workspace_id' });

      if (error) {
        console.error('Batch insert error:', error);
      } else {
        imported += batch.length;

        const progress = 50 + Math.round((imported / boundaries.length) * 40);
        await broadcastProgress(supabase, channelName, {
          status: 'importing',
          message: `Imported ${imported}/${boundaries.length} boundaries...`,
          progress,
          importedBoundaries: imported,
          totalBoundaries: boundaries.length,
        });
      }
    }

    // Emit progress: Building hierarchy
    await broadcastProgress(supabase, channelName, {
      status: 'importing',
      message: 'Building parent-child relationships...',
      progress: 95,
    });

    // Update parent_id using spatial containment
    // LGAs (level 6) are contained by States (level 4)
    await supabase.rpc('update_admin_unit_parents', {
      p_country_id: countryId,
    });

    // Emit progress: Complete
    await broadcastProgress(supabase, channelName, {
      status: 'complete',
      message: `Successfully imported ${imported} admin boundaries`,
      progress: 100,
      importedBoundaries: imported,
      totalBoundaries: boundaries.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    await broadcastProgress(supabase, channelName, {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Broadcast progress update via Supabase Realtime
 */
async function broadcastProgress(
  supabase: any,
  channel: string,
  progress: any
): Promise<void> {
  try {
    await supabase
      .channel(channel)
      .send({
        type: 'broadcast',
        event: 'progress',
        payload: progress,
      });
  } catch (error) {
    console.error('Failed to broadcast progress:', error);
  }
}

/**
 * Calculate centroid of geometry
 */
function calculateCentroid(geometry: any): { lat: number; lng: number } {
  let totalLat = 0;
  let totalLng = 0;
  let pointCount = 0;

  const processRing = (coords: number[][]) => {
    for (const [lng, lat] of coords) {
      totalLng += lng;
      totalLat += lat;
      pointCount++;
    }
  };

  if (geometry.type === 'Polygon') {
    processRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      processRing(polygon[0]);
    }
  }

  return {
    lat: totalLat / pointCount,
    lng: totalLng / pointCount,
  };
}
