import { Facility } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, MapPin, Eye } from 'lucide-react';

interface FacilitiesTableProps {
  facilities: Facility[];
  visibleColumns: Record<string, boolean>;
  selectedRows: Set<string>;
  onRowClick: (facility: Facility) => void;
  onRowSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEdit: (facility: Facility) => void;
  onDelete: (id: string) => void;
}

export function FacilitiesTable({
  facilities,
  visibleColumns,
  selectedRows,
  onRowClick,
  onRowSelect,
  onSelectAll,
  onEdit,
  onDelete,
}: FacilitiesTableProps) {
  const allSelected = facilities.length > 0 && facilities.every(f => selectedRows.has(f.id));
  const someSelected = facilities.some(f => selectedRows.has(f.id)) && !allSelected;

  const handleOpenMap = (lat: number, lng: number, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Select all"
                className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
              />
            </TableHead>
            {visibleColumns.warehouse_code && (
              <TableHead>Warehouse Code</TableHead>
            )}
            {visibleColumns.name && <TableHead>Name</TableHead>}
            {visibleColumns.lga && <TableHead>LGA</TableHead>}
            {visibleColumns.ward && <TableHead>Ward</TableHead>}
            {visibleColumns.level_of_care && (
              <TableHead>Level of Care</TableHead>
            )}
            {visibleColumns.ip_name && <TableHead>IP Name</TableHead>}
            {visibleColumns.programme && <TableHead>Programme</TableHead>}
            {visibleColumns.funding_source && (
              <TableHead>Funding Source</TableHead>
            )}
            {visibleColumns.service_zone && (
              <TableHead>Service Zone</TableHead>
            )}
            {visibleColumns.coordinates && (
              <TableHead>Coordinates</TableHead>
            )}
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {facilities.map((facility) => (
            <TableRow
              key={facility.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(facility)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedRows.has(facility.id)}
                  onCheckedChange={(checked) =>
                    onRowSelect(facility.id, checked as boolean)
                  }
                  aria-label={`Select ${facility.name}`}
                />
              </TableCell>
              {visibleColumns.warehouse_code && (
                <TableCell className="font-mono text-sm">
                  {facility.warehouse_code}
                </TableCell>
              )}
              {visibleColumns.name && (
                <TableCell className="font-medium">{facility.name}</TableCell>
              )}
              {visibleColumns.lga && (
                <TableCell>{facility.lga || '-'}</TableCell>
              )}
              {visibleColumns.ward && (
                <TableCell>{facility.ward || '-'}</TableCell>
              )}
              {visibleColumns.level_of_care && (
                <TableCell>
                  {facility.level_of_care ? (
                    <Badge variant="outline">{facility.level_of_care}</Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
              )}
              {visibleColumns.ip_name && (
                <TableCell>
                  <BadgeList values={facility.ip_names?.length ? facility.ip_names : facility.ip_name ? [facility.ip_name] : []} variant="outline" />
                </TableCell>
              )}
              {visibleColumns.programme && (
                <TableCell>
                  <BadgeList values={facility.programmes?.length ? facility.programmes : facility.programme ? [facility.programme] : []} variant="secondary" />
                </TableCell>
              )}
              {visibleColumns.funding_source && (
                <TableCell>
                  <BadgeList values={facility.funding_sources?.length ? facility.funding_sources : facility.funding_source ? [facility.funding_source] : []} />
                </TableCell>
              )}
              {visibleColumns.service_zone && (
                <TableCell>{facility.service_zone || '-'}</TableCell>
              )}
              {visibleColumns.coordinates && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => handleOpenMap(facility.lat, facility.lng, e)}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    {facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}
                  </Button>
                </TableCell>
              )}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRowClick(facility)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(facility)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(facility.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BadgeList({
  values,
  variant = 'secondary',
}: {
  values: string[];
  variant?: React.ComponentProps<typeof Badge>['variant'];
}) {
  if (!values.length) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Badge key={v} variant={variant} className="text-xs">
          {v}
        </Badge>
      ))}
    </div>
  );
}
