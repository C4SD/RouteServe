import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { SchedulerBatch } from '@/types/scheduler';
import type { Facility, Vehicle } from '@/types';

interface Warehouse {
  id: string;
  name: string;
}

export function exportSchedulePdf(
  batches: SchedulerBatch[],
  facilities: Facility[],
  warehouses: Warehouse[],
  vehicles: Vehicle[],
  title = 'Delivery Schedule Export'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = format(new Date(), 'dd MMM yyyy, HH:mm');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Generated: ${now}  |  Schedules: ${batches.length}`, 14, 23);
  doc.setTextColor(0);

  let yOffset = 30;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // Page break for each batch after the first (leave header on first page)
    if (i > 0) {
      doc.addPage();
      yOffset = 16;
    }

    const warehouse = warehouses.find(w => w.id === batch.warehouse_id);
    const vehicle = vehicles.find(v => v.id === batch.vehicle_id);
    const batchFacilities = (batch.facility_ids || [])
      .map(id => facilities.find(f => f.id === id))
      .filter(Boolean) as Facility[];

    const plannedDate = batch.planned_date
      ? format(new Date(batch.planned_date), 'dd MMM yyyy')
      : '—';
    const timeWindow = batch.time_window
      ? batch.time_window.charAt(0).toUpperCase() + batch.time_window.slice(1)
      : '—';

    // Batch title bar
    doc.setFillColor(34, 197, 94);
    doc.rect(14, yOffset, pageWidth - 28, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text(
      `${batch.batch_code}${batch.name ? '  —  ' + batch.name : ''}`,
      17,
      yOffset + 5.5
    );
    doc.setTextColor(0);

    yOffset += 11;

    // Trip info summary row
    const summaryData = [
      ['Status', batch.status.toUpperCase()],
      ['Date', plannedDate],
      ['Time Window', timeWindow],
      ['Warehouse', warehouse?.name || '—'],
      ['Vehicle', vehicle ? `${vehicle.model} (${vehicle.plateNumber})` : '—'],
      ['Facilities', String(batchFacilities.length)],
      ['Priority', batch.priority],
    ];

    autoTable(doc, {
      startY: yOffset,
      head: [summaryData.map(([k]) => k)],
      body: [summaryData.map(([, v]) => v)],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    yOffset = (doc as any).lastAutoTable.finalY + 6;

    // Notes
    if (batch.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      doc.text(`Notes: ${batch.notes}`, 14, yOffset);
      doc.setTextColor(0);
      yOffset += 6;
    }

    // Facilities table
    if (batchFacilities.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Scheduled Facilities (Route Order)', 14, yOffset);
      yOffset += 3;

      autoTable(doc, {
        startY: yOffset,
        head: [['#', 'Facility Code', 'Facility Name', 'Address', 'LGA', 'Programme', 'IP Partner', 'Zone', 'Level of Care']],
        body: batchFacilities.map((f, idx) => [
          String(idx + 1),
          f.warehouse_code || '—',
          f.name,
          f.address || '—',
          f.lga || '—',
          (f.programmes || (f.programme ? [f.programme] : [])).join(', ') || '—',
          (f.ip_names || (f.ip_name ? [f.ip_name] : [])).join(', ') || '—',
          f.service_zone || '—',
          f.level_of_care || '—',
        ]),
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 24 },
          2: { cellWidth: 40 },
          3: { cellWidth: 50 },
          4: { cellWidth: 18 },
        },
        margin: { left: 14, right: 14 },
      });

      yOffset = (doc as any).lastAutoTable.finalY + 4;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('No facilities assigned to this schedule.', 14, yOffset);
      doc.setTextColor(0);
      yOffset += 8;
    }
  }

  // Footer on each page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
    doc.text('Log4 — Delivery Schedule Export', 14, doc.internal.pageSize.getHeight() - 6);
    doc.setTextColor(0);
  }

  const filename = `schedule-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(filename);
}
