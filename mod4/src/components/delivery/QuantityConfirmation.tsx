// MOD4 Quantity Confirmation Component
// Line-item verification with expected vs delivered quantities

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DeliveryItem } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { 
  Package, Minus, Plus, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityConfirmationProps {
  items: DeliveryItem[];
  onItemsChange: (items: DeliveryItem[]) => void;
  onContinue: () => void;
}

export function QuantityConfirmation({
  items,
  onItemsChange,
  onContinue,
}: QuantityConfirmationProps) {
  const hasDiscrepancy = items.some(item => item.delivered_quantity !== item.expected_quantity);
  const allConfirmed = items.length > 0;

  const updateQuantity = (itemId: string, delta: number) => {
    const updated = items.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.delivered_quantity + delta);
        return { ...item, delivered_quantity: newQty };
      }
      return item;
    });
    onItemsChange(updated);
  };

  const setQuantity = (itemId: string, quantity: number) => {
    const updated = items.map(item => {
      if (item.id === itemId) {
        return { ...item, delivered_quantity: Math.max(0, quantity) };
      }
      return item;
    });
    onItemsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Delivery Items
        </h3>
        <span className="text-sm text-muted-foreground">
          {items.length} items
        </span>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isMatch = item.delivered_quantity === item.expected_quantity;
          const isShort = item.delivered_quantity < item.expected_quantity;
          const isOver = item.delivered_quantity > item.expected_quantity;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "p-4 rounded-xl border transition-colors",
                isMatch 
                  ? "bg-card border-border/50" 
                  : "bg-warning/5 border-warning/30"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg",
                  isMatch ? "bg-success/20" : "bg-warning/20"
                )}>
                  {isMatch ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  )}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.name}
                  </h4>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                  
                  {/* Expected vs Delivered */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                      Expected: <span className="font-semibold text-foreground">{item.expected_quantity}</span> {item.unit}
                    </span>
                    {!isMatch && (
                      <span className={cn(
                        "text-xs font-semibold",
                        isShort ? "text-warning" : "text-info"
                      )}>
                        ({isShort ? '-' : '+'}{Math.abs(item.expected_quantity - item.delivered_quantity)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                <span className="text-sm font-medium text-foreground">
                  Delivered:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={item.delivered_quantity <= 0}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <input
                    name={`quantity-${item.id}`}
                    type="number"
                    value={item.delivered_quantity}
                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                    className="w-16 h-10 text-center text-lg font-bold bg-secondary rounded-lg border-0 focus:ring-2 focus:ring-primary"
                  />
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={() => updateQuantity(item.id, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  
                  <span className="text-sm text-muted-foreground w-12">
                    {item.unit}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Discrepancy warning */}
      {hasDiscrepancy && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30"
        >
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Quantity mismatch detected
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll need to provide a reason for the discrepancy in the next step.
            </p>
          </div>
        </motion.div>
      )}

      {/* Continue button */}
      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={onContinue}
        disabled={!allConfirmed}
      >
        {hasDiscrepancy ? 'Resolve Discrepancy' : 'Continue'}
      </Button>
    </div>
  );
}