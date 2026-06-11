import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, RotateCcw, Truck } from 'lucide-react';

export function ScenarioPanel() {
    return (
        <Card className="p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-muted shadow-lg w-64 mt-2">
            <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Scenario Simulation
            </div>

            <div className="space-y-3">
                <div className="space-y-2">
                    <label className="text-xs font-medium">Facilities</label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                            <Plus className="mr-1 h-3 w-3" /> Add New
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                            Disable
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="fleet-capacity" className="text-xs font-medium">Fleet Capacity</label>
                    <div className="flex items-center gap-2">
                        <input id="fleet-capacity" name="fleet-capacity" type="range" className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer" />
                        <span className="text-xs w-8 text-right">100%</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                        <RotateCcw className="mr-2 h-3 w-3" /> Reset Scenarios
                    </Button>
                </div>
            </div>
        </Card>
    );
}
