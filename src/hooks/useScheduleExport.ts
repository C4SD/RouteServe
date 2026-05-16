import { format } from 'date-fns';
import { DeliverySchedule } from './useDeliverySchedules';

export function useScheduleExport() {
  const exportToPDF = async (schedule: DeliverySchedule) => {
    // Lazy load PDF library only when needed
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('RouteServe Delivery Schedule', 14, 20);

    // Schedule Details
    doc.setFontSize(12);
    doc.text(`Batch: ${schedule.title}`, 14, 30);
    doc.text(`Date: ${format(new Date(schedule.planned_date), 'MMMM dd, yyyy')}`, 14, 37);
    doc.text(`Time Window: ${schedule.time_window}`, 14, 44);

    // Divider
    doc.line(14, 48, 196, 48);

    // Vehicle & Driver Info
    doc.text(`Warehouse: ${schedule.warehouse?.name || 'N/A'}`, 14, 56);
    doc.text(`Driver: ${schedule.driver?.name || 'Not assigned'}`, 14, 63);
    doc.text(`Vehicle: ${schedule.vehicle?.model || 'Not assigned'} ${schedule.vehicle?.plate_number ? `(${schedule.vehicle.plate_number})` : ''}`, 14, 70);
    doc.text(`Payload: ${schedule.total_payload_kg}kg / ${schedule.total_volume_m3}m³`, 14, 77);

    // Route summary
    doc.text(`Status: ${schedule.status}`, 14, 84);
    doc.text(`Facilities: ${schedule.facility_ids.length}`, 14, 91);

    // Save
    doc.save(`schedule-${schedule.title}-${schedule.planned_date}.pdf`);
  };

  const exportToExcel = async (schedule: DeliverySchedule) => {
    // Lazy load Excel library only when needed
    const ExcelJS = await import('exceljs');

    // Summary Sheet
    const summaryData = [
      ['Schedule Title', schedule.title],
      ['Planned Date', schedule.planned_date],
      ['Time Window', schedule.time_window],
      ['Warehouse', schedule.warehouse?.name || 'N/A'],
      ['Driver', schedule.driver?.name || 'Not assigned'],
      ['Vehicle', schedule.vehicle ? `${schedule.vehicle.model} (${schedule.vehicle.plate_number})` : 'Not assigned'],
      ['Total Payload', `${schedule.total_payload_kg} kg`],
      ['Total Volume', `${schedule.total_volume_m3} m³`],
      ['Status', schedule.status],
      ['Facilities Count', schedule.facility_ids.length]
    ];

    // Create Workbook
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');

    summaryData.forEach(row => summarySheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule.title}-${schedule.planned_date}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { exportToPDF, exportToExcel };
}
