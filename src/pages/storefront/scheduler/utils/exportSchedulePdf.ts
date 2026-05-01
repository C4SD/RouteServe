import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addMinutes } from 'date-fns';
import type { SchedulerBatch } from '@/types/scheduler';
import type { Facility, Vehicle, Driver } from '@/types';
import { computeRouteMetrics, DEFAULT_SERVICE_TIME_MIN } from '@/lib/schedulerUtils';

interface Warehouse {
  id: string;
  name: string;
  lat?: number | string | null;
  lng?: number | string | null;
}

const BRAND_GREEN: [number, number, number] = [34, 197, 94];
const BRAND_BLUE: [number, number, number] = [59, 130, 246];
const GRAY_HEADER: [number, number, number] = [243, 244, 246];
const GRAY_TEXT: [number, number, number] = [75, 85, 99];
const DARK_GRAY: [number, number, number] = [31, 41, 55];

function fmtTime(baseDate: Date, offsetMin: number): string {
  return format(addMinutes(baseDate, offsetMin), 'HH:mm');
}

function fmtKm(km: number): string {
  return km > 0 ? `${km.toFixed(1)} km` : '—';
}

export function exportSchedulePdf(
  batches: SchedulerBatch[],
  facilities: Facility[],
  warehouses: Warehouse[],
  vehicles: Vehicle[],
  drivers: Driver[] = [],
  title = 'Delivery Schedule Export',
  waitingTimeMin: number = DEFAULT_SERVICE_TIME_MIN
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const now = format(new Date(), 'dd MMM yyyy, HH:mm');

  // ─── Lookup maps ───────────────────────────────────────────────────────────
  const facilityMap: Record<string, Facility> = {};
  for (const f of facilities) facilityMap[f.id] = f;

  const warehouseMap: Record<string, Warehouse> = {};
  for (const w of warehouses) warehouseMap[w.id] = w;

  const vehicleMap: Record<string, Vehicle> = {};
  for (const v of vehicles) vehicleMap[v.id] = v;

  const driverMap: Record<string, Driver> = {};
  for (const d of drivers) driverMap[d.id] = d;

  // ─── Page footer helper ────────────────────────────────────────────────────
  function addFooter(page: number, total: number) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${page} of ${total}`, pageWidth - marginR, pageHeight - 5, { align: 'right' });
    doc.text('Log4 — Delivery Schedule Export', marginL, pageHeight - 5);
    doc.setTextColor(0);
  }

  // ─── Section heading helper ────────────────────────────────────────────────
  function sectionHeading(label: string, y: number): number {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(label.toUpperCase(), marginL, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    return y + 4;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COVER / FIRST PAGE HEADER
  // ──────────────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_GRAY);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, marginL, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Generated: ${now}  ·  Schedules: ${batches.length}`,
    marginL,
    19,
  );
  doc.setTextColor(0);

  let yOffset = 28;

  // ──────────────────────────────────────────────────────────────────────────
  // BATCH PAGES
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (i > 0) {
      doc.addPage();
      yOffset = 16;
    }

    const warehouse = batch.warehouse_id ? warehouseMap[batch.warehouse_id] : null;
    const vehicle = batch.vehicle_id ? vehicleMap[batch.vehicle_id] : null;
    const driver = batch.driver_id ? driverMap[batch.driver_id] : null;

    const batchFacilities = (batch.facility_ids || [])
      .map(id => facilityMap[id])
      .filter(Boolean) as Facility[];

    // Compute per-stop route metrics
    const startLocation =
      warehouse?.lat && warehouse?.lng
        ? { lat: Number(warehouse.lat), lng: Number(warehouse.lng) }
        : null;

    const routeMetrics = batchFacilities.length
      ? computeRouteMetrics(batch.facility_ids, facilityMap as any, startLocation, waitingTimeMin)
      : null;

    const totalDistanceKm =
      batch.total_distance_km ?? routeMetrics?.totalDistanceKm ?? null;
    const estimatedDurationMin =
      batch.estimated_duration_min ?? routeMetrics?.estimatedDurationMin ?? null;

    // Build a departure Date for ETA formatting
    const departureDate = batch.planned_date ? new Date(batch.planned_date) : null;

    const plannedDateStr = batch.planned_date
      ? format(new Date(batch.planned_date), 'dd MMM yyyy')
      : '—';
    const timeWindow = batch.time_window
      ? batch.time_window.charAt(0).toUpperCase() + batch.time_window.slice(1)
      : '—';

    // ── Batch title bar ──────────────────────────────────────────────────────
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(marginL, yOffset, pageWidth - marginL - marginR, 9, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(
      `${batch.batch_code}${batch.name ? '  —  ' + batch.name : ''}`,
      marginL + 3,
      yOffset + 6,
    );
    doc.setTextColor(0);
    yOffset += 12;

    // ── Trip meta summary (horizontal) ──────────────────────────────────────
    const metaCols = [
      ['Status', batch.status.toUpperCase()],
      ['Date', plannedDateStr],
      ['Time Window', timeWindow],
      ['Warehouse', warehouse?.name || '—'],
      ['Priority', batch.priority.charAt(0).toUpperCase() + batch.priority.slice(1)],
      ['Scheduling', batch.scheduling_mode === 'ai_optimized' ? 'AI Optimised' : 'Manual'],
      ['Stops', String(batchFacilities.length)],
      ['Total Distance', totalDistanceKm != null ? `${totalDistanceKm.toFixed(1)} km` : '—'],
      ['Est. Duration', estimatedDurationMin != null ? `${Math.round(estimatedDurationMin)} min` : '—'],
    ];

    autoTable(doc, {
      startY: yOffset,
      head: [metaCols.map(([k]) => k)],
      body: [metaCols.map(([, v]) => v)],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: GRAY_HEADER, textColor: GRAY_TEXT, fontStyle: 'bold' },
      margin: { left: marginL, right: marginR },
    });

    yOffset = (doc as any).lastAutoTable.finalY + 4;

    // ── Assignment row (Driver + Vehicle) ────────────────────────────────────
    const vehicleLabel = vehicle
      ? [
          (vehicle as any).model || (vehicle as any).vehicle_type || '',
          (vehicle as any).plateNumber || (vehicle as any).plate_number || (vehicle as any).license_plate || '',
        ]
          .filter(Boolean)
          .join(' ')
      : batch.vehicle_id
        ? batch.vehicle_id
        : '—';

    const driverLabel = driver
      ? driver.name
      : batch.driver_id
        ? batch.driver_id
        : 'Not assigned';

    const assignCols = [
      ['Assigned Driver', driverLabel],
      ['Driver Phone', driver?.phone || '—'],
      ['Vehicle', vehicleLabel],
      ['Vehicle Type', (vehicle as any)?.vehicle_type || (vehicle as any)?.type || '—'],
      ['Capacity', (vehicle as any)?.capacity_kg ? `${(vehicle as any).capacity_kg} kg` : (vehicle as any)?.capacity ? `${(vehicle as any).capacity} units` : '—'],
    ];

    autoTable(doc, {
      startY: yOffset,
      head: [assignCols.map(([k]) => k)],
      body: [assignCols.map(([, v]) => v)],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [224, 242, 254], textColor: [14, 116, 144], fontStyle: 'bold' },
      margin: { left: marginL, right: marginR },
    });

    yOffset = (doc as any).lastAutoTable.finalY + 5;

    // ── Notes ────────────────────────────────────────────────────────────────
    if (batch.notes) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      doc.text(`Notes: ${batch.notes}`, marginL, yOffset);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      yOffset += 5;
    }

    // ── Facility sequence table ──────────────────────────────────────────────
    if (batchFacilities.length > 0) {
      yOffset = sectionHeading('Facility Sequence — Route Order', yOffset);

      const stopMap: Record<string, (typeof routeMetrics)['stops'][number]> = {};
      for (const s of routeMetrics?.stops ?? []) stopMap[s.facility_id] = s;

      const tableHead = [
        '#',
        'Code',
        'Facility Name',
        'LGA',
        'Dist (km)',
        'Cumul. (km)',
        'ETA',
        'Wait SLA (min)',
        'Programme',
        'Level of Care',
      ];

      const tableBody = batchFacilities.map((f, idx) => {
        const stop = stopMap[f.id];
        const etaStr =
          stop && departureDate
            ? fmtTime(departureDate, stop.eta_minutes)
            : '—';
        const distPrev = stop ? fmtKm(stop.distance_from_prev_km) : '—';
        const cumulDist = stop ? fmtKm(stop.cumulative_distance_km) : '—';
        const waitSLA = stop ? String(stop.waiting_time_min) : String(waitingTimeMin);
        const programmes = (f.programmes || (f.programme ? [f.programme] : [])).join(', ') || '—';

        return [
          String(idx + 1),
          f.warehouse_code || '—',
          f.name,
          f.lga || '—',
          distPrev,
          cumulDist,
          etaStr,
          waitSLA,
          programmes,
          f.level_of_care || '—',
        ];
      });

      autoTable(doc, {
        startY: yOffset,
        head: [tableHead],
        body: tableBody,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 48 },
          3: { cellWidth: 18 },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 18, halign: 'center' },
          7: { cellWidth: 22, halign: 'center' },
          8: { cellWidth: 34 },
          9: { cellWidth: 26 },
        },
        margin: { left: marginL, right: marginR },
      });

      yOffset = (doc as any).lastAutoTable.finalY + 4;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('No facilities assigned to this schedule.', marginL, yOffset);
      doc.setTextColor(0);
      yOffset += 8;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY PAGE
  // ──────────────────────────────────────────────────────────────────────────
  doc.addPage();

  // Summary header bar
  doc.setFillColor(...DARK_GRAY);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Export Summary', marginL, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`${batches.length} schedule(s)  ·  ${now}`, pageWidth - marginR, 12, { align: 'right' });
  doc.setTextColor(0);

  yOffset = 26;

  // Aggregate stats
  const totalFacilities = batches.reduce((s, b) => s + (b.facility_ids?.length || 0), 0);
  const totalDist = batches.reduce((s, b) => s + (b.total_distance_km || 0), 0);
  const uniqueDrivers = new Set(batches.map(b => b.driver_id).filter(Boolean)).size;
  const uniqueVehicles = new Set(batches.map(b => b.vehicle_id).filter(Boolean)).size;

  const statsCols = [
    ['Total Schedules', String(batches.length)],
    ['Total Facilities', String(totalFacilities)],
    ['Total Distance', totalDist > 0 ? `${totalDist.toFixed(1)} km` : '—'],
    ['Assigned Drivers', String(uniqueDrivers)],
    ['Assigned Vehicles', String(uniqueVehicles)],
  ];

  autoTable(doc, {
    startY: yOffset,
    head: [statsCols.map(([k]) => k)],
    body: [statsCols.map(([, v]) => v)],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, fontStyle: 'bold' },
    headStyles: { fillColor: GRAY_HEADER, textColor: GRAY_TEXT, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: DARK_GRAY },
    margin: { left: marginL, right: marginR },
  });

  yOffset = (doc as any).lastAutoTable.finalY + 8;
  yOffset = sectionHeading('Schedule Overview', yOffset);

  const summaryHead = [
    'Batch Code',
    'Name',
    'Date',
    'Status',
    'Warehouse',
    'Driver',
    'Vehicle',
    'Stops',
    'Total Dist.',
    'Est. Duration',
    'Priority',
  ];

  const summaryBody = batches.map(b => {
    const wh = b.warehouse_id ? warehouseMap[b.warehouse_id] : null;
    const vh = b.vehicle_id ? vehicleMap[b.vehicle_id] : null;
    const dr = b.driver_id ? driverMap[b.driver_id] : null;
    const dist = b.total_distance_km != null ? `${b.total_distance_km.toFixed(1)} km` : '—';
    const dur = b.estimated_duration_min != null ? `${Math.round(b.estimated_duration_min)} min` : '—';
    const vLabel = vh
      ? [
          (vh as any).model || '',
          (vh as any).plateNumber || (vh as any).plate_number || (vh as any).license_plate || '',
        ]
          .filter(Boolean)
          .join(' ')
      : '—';

    return [
      b.batch_code,
      b.name || '—',
      b.planned_date ? format(new Date(b.planned_date), 'dd MMM yyyy') : '—',
      b.status.toUpperCase(),
      wh?.name || '—',
      dr?.name || (b.driver_id ? b.driver_id.slice(0, 8) : 'Unassigned'),
      vLabel,
      String(b.facility_ids?.length || 0),
      dist,
      dur,
      b.priority.charAt(0).toUpperCase() + b.priority.slice(1),
    ];
  });

  autoTable(doc, {
    startY: yOffset,
    head: [summaryHead],
    body: summaryBody,
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BRAND_GREEN, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 20 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 28 },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 22, halign: 'right' },
      10: { cellWidth: 18 },
    },
    margin: { left: marginL, right: marginR },
  });

  // ── Footers on all pages ───────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    addFooter(p, totalPages);
  }

  const filename = `schedule-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(filename);
}
