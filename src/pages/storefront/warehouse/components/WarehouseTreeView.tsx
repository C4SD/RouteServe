import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Warehouse as WarehouseIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Zap,
  ZapOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouseTree } from '@/hooks/useWarehouses';
import type { Warehouse } from '@/types/warehouse';
import { STORAGE_CONDITIONS } from '@/types/warehouse';

interface WarehouseTreeViewProps {
  onAddChild: (parentId: string) => void;
  onEdit: (warehouse: Warehouse) => void;
  onSelect: (warehouse: Warehouse) => void;
  selectedWarehouseId?: string;
  searchTerm?: string;
}

interface WarehouseNode extends Warehouse {
  level: number;
}

export function WarehouseTreeView({
  onAddChild,
  onEdit,
  onSelect,
  selectedWarehouseId,
  searchTerm,
}: WarehouseTreeViewProps) {
  const { data: tree = [], isLoading } = useWarehouseTree();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Auto-expand root nodes on load
  useEffect(() => {
    if (tree.length > 0) {
      setExpandedNodes(new Set(tree.map(n => n.id)));
    }
  }, [tree]);

  // Expand all nodes when searching
  useEffect(() => {
    if (searchTerm) {
      const allIds = new Set<string>();
      function collectIds(nodes: Warehouse[]) {
        for (const node of nodes) {
          allIds.add(node.id);
          if (node.children) collectIds(node.children);
        }
      }
      collectIds(tree);
      setExpandedNodes(allIds);
    }
  }, [searchTerm, tree]);

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Filter tree by search term
  function matchesSearch(node: Warehouse): boolean {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (node.name.toLowerCase().includes(term) || node.code.toLowerCase().includes(term)) return true;
    return (node.children || []).some(matchesSearch);
  }

  const getCapabilityBadges = (capabilities: Warehouse['capabilities']) => {
    const badges: { key: string; label: string; icon: React.ReactNode; color: string }[] = [];
    if (capabilities.can_receive) badges.push({ key: 'receive', label: 'Receive', icon: <ArrowDownToLine className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700' });
    if (capabilities.can_dispatch) badges.push({ key: 'dispatch', label: 'Dispatch', icon: <ArrowUpFromLine className="h-3 w-3" />, color: 'bg-orange-100 text-orange-700' });
    if (capabilities.can_store) badges.push({ key: 'store', label: 'Store', icon: <Database className="h-3 w-3" />, color: 'bg-green-100 text-green-700' });
    return badges;
  };

  const getConditionConfig = (condition: string) => {
    return STORAGE_CONDITIONS.find(c => c.value === condition);
  };

  const renderNode = (node: Warehouse, level: number = 0) => {
    if (!matchesSearch(node)) return null;

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children || []).length > 0;
    const indentLevel = level * 24;
    const isSelected = selectedWarehouseId === node.id;

    const utilization = node.total_capacity_m3 && node.total_capacity_m3 > 0
      ? ((node.used_capacity_m3 || 0) / node.total_capacity_m3) * 100
      : 0;

    const capabilityBadges = getCapabilityBadges(node.capabilities);

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            'flex items-center gap-2 p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors',
            isSelected && 'bg-blue-50 hover:bg-blue-50'
          )}
          style={{ marginLeft: `${indentLevel}px` }}
          onClick={() => onSelect(node)}
        >
          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          {/* Icon */}
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full',
            level === 0 ? 'bg-primary/10' : 'bg-muted',
          )}>
            {level === 0 ? (
              <WarehouseIcon className="h-4 w-4 text-primary" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.name}</span>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5">
                {node.code}
              </Badge>
              {node.storage_mode === 'active' ? (
                <Badge className="text-[10px] px-1.5 bg-green-100 text-green-800 gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                  <ZapOff className="h-2.5 w-2.5" />
                  Passive
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {capabilityBadges.map(badge => (
                <Badge key={badge.key} className={cn('text-[10px] px-1.5 py-0 font-normal gap-1', badge.color)}>
                  {badge.icon}
                  {badge.label}
                </Badge>
              ))}
              {node.storage_conditions.map(condition => {
                const config = getConditionConfig(condition);
                return config ? (
                  <Badge key={condition} className={cn('text-[10px] px-1.5 py-0 font-normal', config.color)}>
                    {config.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          {/* Capacity mini-bar */}
          {node.total_capacity_m3 ? (
            <div className="w-24 space-y-0.5 text-right">
              <span className="text-xs text-muted-foreground">{utilization.toFixed(0)}%</span>
              <Progress
                value={utilization}
                className={cn(
                  'h-1.5',
                  utilization > 80 && '[&>div]:bg-red-500',
                  utilization > 50 && utilization <= 80 && '[&>div]:bg-amber-500',
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                {node.total_capacity_m3.toLocaleString()} m³
              </span>
            </div>
          ) : null}

          {/* Stats */}
          {hasChildren && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <span>{(node.children || []).length}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title={level === 0 ? 'Add Store' : 'Add sub-node'}
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-muted">
            {(node.children || []).map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <WarehouseIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground">Loading warehouse hierarchy...</p>
        </div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <WarehouseIcon className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No warehouses found</p>
        <p className="text-sm">Add a warehouse to see the hierarchy</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1">
      {tree.map(node => renderNode(node))}
    </div>
  );
}
