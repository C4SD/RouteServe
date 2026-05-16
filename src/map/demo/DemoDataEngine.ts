/**
 * DemoDataEngine
 *
 * Production-grade simulation engine for RouteServe MapRuntime
 *
 * Features:
 * - Realistic vehicle movement with traffic
 * - Event streaming (delays, deliveries, alerts)
 * - Deterministic replay (seeded RNG)
 * - Forensic timeline generation
 */

import { mapRuntime, type PlaybackData } from '@/map/runtime/MapRuntime';
import { facilities } from './kano/facilities';
import { warehouses } from './kano/warehouses';
import { simulationVehicles } from './kano/vehicles';
import { routes } from './kano/routes';
import {
  advanceVehicle,
  initializeVehicleSimulation,
  resetVehicle,
  addDelayEvent,
  type VehicleSimState,
} from './simulator/movementEngine';
import { seededRandom } from './simulator/geoUtils';
import { maybeEmitDelay } from './simulator/speedModel';
import type { Vehicle } from '@/types';

export type DemoMode = 'operational' | 'planning' | 'forensic';

export interface DemoEngineConfig {
  mode: DemoMode;
  seed?: number;
  tickIntervalMs?: number;
  playbackSpeed?: number;
}

/**
 * Demo Data Engine
 *
 * Manages simulation state and emits events to MapRuntime
 */
export interface VehicleTrail {
  vehicle_id: string;
  points: { lat: number; lng: number; ts: string }[];
  status?: string;
}

export class DemoDataEngine {
  private config: Required<DemoEngineConfig>;
  private isRunning = false;
  private intervalId: number | null = null;
  private simulationTime: Date;
  private rng: () => number;
  private vehicleStates = new Map<string, VehicleSimState>();
  private vehicleTrails = new Map<string, VehicleTrail>();
  private eventLog: any[] = [];
  private readonly MAX_TRAIL_POINTS = 50;

  constructor(config: DemoEngineConfig) {
    this.config = {
      mode: config.mode,
      seed: config.seed ?? 42,
      tickIntervalMs: config.tickIntervalMs ?? 2000,
      playbackSpeed: config.playbackSpeed ?? 1,
    };

    // Initialize simulation time (24 hours ago for forensic)
    this.simulationTime =
      config.mode === 'forensic'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date();

    // Initialize RNG (deterministic for replay)
    this.rng = seededRandom(this.config.seed);

    // Initialize vehicle simulation states
    this.initializeVehicles();
  }

  /**
   * Initialize vehicle states from route data
   */
  private initializeVehicles(): void {
    routes.forEach((route) => {
      const vehicle = simulationVehicles.find((v) => v.id === route.vehicleId);
      if (vehicle) {
        // Calculate initial capacity from waypoints
        const initialCapacity = route.waypoints
          ? route.waypoints.reduce((sum, wp) => sum + wp.slotsToDeliver, 0)
          : 100;

        const state = initializeVehicleSimulation(
          route.vehicleId,
          route.polyline,
          vehicle.baseSpeedKmh,
          route.waypoints,
          initialCapacity
        );
        this.vehicleStates.set(route.vehicleId, state);

        // Initialize trail with starting position
        this.vehicleTrails.set(route.vehicleId, {
          vehicle_id: route.vehicleId,
          points: [
            {
              lat: state.position[1],
              lng: state.position[0],
              ts: this.simulationTime.toISOString(),
            },
          ],
          status: 'active',
        });
      }
    });

    console.log(`[DemoEngine] Initialized ${this.vehicleStates.size} vehicles`);
  }

  /**
   * Start simulation
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[DemoEngine] Already running');
      return;
    }

    this.isRunning = true;

    console.log(`[DemoEngine] Starting in ${this.config.mode} mode`);

    // Start tick loop
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, this.config.tickIntervalMs / this.config.playbackSpeed);

    // Initial data push
    this.emitData();
  }

  /**
   * Stop simulation
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[DemoEngine] Stopped');
  }

  /**
   * Reset simulation to start
   */
  reset(): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    // Reset time
    this.simulationTime =
      this.config.mode === 'forensic'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date();

    // Reset RNG
    this.rng = seededRandom(this.config.seed);

    // Reset vehicles
    this.vehicleStates.forEach((state, vehicleId) => {
      this.vehicleStates.set(vehicleId, resetVehicle(state));
    });

    // Clear event log
    this.eventLog = [];

    console.log('[DemoEngine] Reset');

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Set playback speed (1x, 2x, 5x, etc.)
   */
  setPlaybackSpeed(speed: number): void {
    this.config.playbackSpeed = speed;

    if (this.isRunning) {
      // Restart interval with new speed
      this.stop();
      this.start();
    }
  }

  /**
   * Main simulation tick
   */
  private tick(): void {
    const deltaSeconds = (this.config.tickIntervalMs / 1000) * this.config.playbackSpeed;

    // Advance simulation time
    this.simulationTime = new Date(
      this.simulationTime.getTime() + deltaSeconds * 1000
    );

    // Advance all vehicles
    this.vehicleStates.forEach((state, vehicleId) => {
      let currentState = state;

      // Check for new delay events (before advancement)
      const delay = maybeEmitDelay(this.rng);
      if (delay) {
        // Add event to vehicle state (affects movement)
        currentState = addDelayEvent(
          currentState,
          delay.reason,
          delay.durationMin,
          this.simulationTime
        );

        // Log event for forensics
        this.logEvent({
          type: 'vehicle_delay',
          vehicleId,
          ...delay,
          timestamp: this.simulationTime.toISOString(),
        });
      }

      // Advance vehicle with event physics applied
      const newState = advanceVehicle({
        state: currentState,
        deltaSeconds,
        timestamp: this.simulationTime,
        rng: this.rng,
      });

      // Check for delivery events (arrival/departure)
      if (newState.deliveryStops && currentState.deliveryStops) {
        newState.deliveryStops.forEach((stop, idx) => {
          const prevStop = currentState.deliveryStops[idx];

          // Detect arrival
          if (stop.arrivedAt && !prevStop.arrivedAt) {
            this.logEvent({
              type: 'delivery_arrival',
              vehicleId,
              facilityId: stop.facilityId,
              timestamp: stop.arrivedAt.toISOString(),
              dwellMinutes: stop.dwellMinutes,
            });
          }

          // Detect departure
          if (stop.departedAt && !prevStop.departedAt) {
            this.logEvent({
              type: 'delivery_complete',
              vehicleId,
              facilityId: stop.facilityId,
              timestamp: stop.departedAt.toISOString(),
              slotsDelivered: stop.slotsDelivered,
              remainingCapacity: newState.currentCapacity,
            });
          }
        });
      }

      this.vehicleStates.set(vehicleId, newState);

      // Update trail with new position (if vehicle moved)
      const trail = this.vehicleTrails.get(vehicleId);
      if (trail && !newState.isComplete) {
        const lastPoint = trail.points[trail.points.length - 1];
        const moved =
          lastPoint.lat !== newState.position[1] ||
          lastPoint.lng !== newState.position[0];

        if (moved) {
          trail.points.push({
            lat: newState.position[1],
            lng: newState.position[0],
            ts: this.simulationTime.toISOString(),
          });

          // Enforce max trail points
          if (trail.points.length > this.MAX_TRAIL_POINTS) {
            trail.points.shift();
          }

          // Update status for color matching
          if (newState.activeEvents.length > 0) {
            const primaryEvent = newState.activeEvents[0];
            if (primaryEvent.reason === 'vehicle_breakdown') {
              trail.status = 'offline';
            } else if (primaryEvent.speedMultiplier === 0) {
              trail.status = 'idle';
            } else {
              trail.status = 'delayed';
            }
          } else {
            trail.status = 'active';
          }
        }
      }

      // Check if vehicle completed route
      if (newState.isComplete && !state.isComplete) {
        this.logEvent({
          type: 'route_complete',
          vehicleId,
          timestamp: this.simulationTime.toISOString(),
        });

        // Mark trail as idle when complete
        const completedTrail = this.vehicleTrails.get(vehicleId);
        if (completedTrail) {
          completedTrail.status = 'idle';
        }
      }
    });

    // Emit updated data to MapRuntime
    this.emitData();
  }

  /**
   * Emit current state to MapRuntime
   */
  private emitData(): void {
    // Convert simulation states to Vehicle data
    const vehicles: Vehicle[] = Array.from(this.vehicleStates.values()).map((state) => {
      const vehicle = simulationVehicles.find((v) => v.id === state.vehicleId)!;

      // Determine status based on active events and dwell state
      let status = 'active';
      if (state.isComplete) {
        status = 'idle';
      } else if (state.isDwelling) {
        status = 'idle'; // Dwelling at delivery stop
      } else if (state.activeEvents.length > 0) {
        const primaryEvent = state.activeEvents[0];
        if (primaryEvent.reason === 'vehicle_breakdown') {
          status = 'offline';
        } else if (primaryEvent.speedMultiplier === 0) {
          status = 'idle';
        } else {
          status = 'delayed';
        }
      }

      return {
        ...vehicle,
        lat: state.position[1],
        lng: state.position[0],
        bearing: state.bearing,
        speed: state.currentSpeedKmh,
        status: status as any, // Type will be fixed in schema updates
        current_load: state.currentCapacity, // Update capacity
      } as any; // Temporary cast until Vehicle type is updated
    });

    // Prepare playback data for forensic mode
    const playback: PlaybackData | undefined =
      this.config.mode === 'forensic'
        ? {
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endTime: new Date(),
            currentTime: this.simulationTime,
            isPlaying: this.isRunning,
            speed: this.config.playbackSpeed,
          }
        : undefined;

    // Collect all trails
    const trails = Array.from(this.vehicleTrails.values());

    // Send to MapRuntime
    mapRuntime.update({
      vehicles,
      trails,
      facilities,
      warehouses,
      playback,
    });
  }

  /**
   * Log event for forensic replay
   */
  private logEvent(event: any): void {
    this.eventLog.push(event);
    console.log('[DemoEngine] Event:', event.type, event);
  }

  /**
   * Get event log (for forensic analysis)
   */
  getEventLog(): any[] {
    return [...this.eventLog];
  }

  /**
   * Get current simulation state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      simulationTime: this.simulationTime,
      vehicleCount: this.vehicleStates.size,
      eventCount: this.eventLog.length,
      completedVehicles: Array.from(this.vehicleStates.values()).filter(
        (s) => s.isComplete
      ).length,
    };
  }
}

// Singleton instance
let demoEngineInstance: DemoDataEngine | null = null;

/**
 * Get or create demo engine instance
 */
export function getDemoEngine(config?: DemoEngineConfig): DemoDataEngine {
  if (!demoEngineInstance && config) {
    demoEngineInstance = new DemoDataEngine(config);
  }

  if (!demoEngineInstance) {
    throw new Error('DemoEngine not initialized. Provide config on first call.');
  }

  return demoEngineInstance;
}

/**
 * Destroy demo engine (cleanup)
 */
export function destroyDemoEngine(): void {
  if (demoEngineInstance) {
    demoEngineInstance.stop();
    demoEngineInstance = null;
  }
}
