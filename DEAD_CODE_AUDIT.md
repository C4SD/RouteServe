# Dead Code Audit — Knip Report

Generated: 2026-04-18  
Tool: [Knip](https://knip.dev)

**Summary:** 575 unused files, 28 unused npm packages, 5 unused devDeps, 544 unused exports

---

## 1. Entire Directories to Delete

These are fully dead — no file in them is imported by the live app.

### `archive/mod4-mobile-system/` (12 files)
Old prototype. Completely superseded by the `/mod4` PWA app.
```
archive/mod4-mobile-system/AuthService.ts
archive/mod4-mobile-system/DeliveryLogic.ts
archive/mod4-mobile-system/EventExecutionService.ts
archive/mod4-mobile-system/events.ts
archive/mod4-mobile-system/LocationCorrectionService.ts
archive/mod4-mobile-system/Mod4Screen.css
archive/mod4-mobile-system/Mod4Screen.tsx
archive/mod4-mobile-system/OfflineStorageAdapter.ts
archive/mod4-mobile-system/SecurityService.ts
archive/mod4-mobile-system/SyncManager.ts
archive/mod4-mobile-system/useGeoLocation.ts
archive/mod4-mobile-system/useMod4Service.ts
```
**Action:** `rm -rf archive/`

---

### `src/fleetops/` (14 files)
Entire module is dead — never imported anywhere in active code.
```
src/fleetops/execution/dispatch-executor.ts
src/fleetops/execution/index.ts
src/fleetops/execution/types.ts
src/fleetops/index.ts
src/fleetops/payload/index.ts
src/fleetops/payload/payload-validator.ts
src/fleetops/planner/index.ts
src/fleetops/planner/route-optimizer.ts
src/fleetops/planner/types.ts
src/fleetops/planner/vehicle-assigner.ts
src/fleetops/scheduler/dispatch-scheduler.ts
src/fleetops/scheduler/index.ts
src/fleetops/scheduler/time-window-assigner.ts
src/fleetops/scheduler/types.ts
```
**Action:** `rm -rf src/fleetops/`

---

### `src/intelligence/` (4 files)
AI/ML models never connected to any UI or data pipeline.
```
src/intelligence/KnowledgeGraph.ts
src/intelligence/PatternRecognitionEngine.ts
src/intelligence/models/CapacityForecastModel.ts
src/intelligence/models/ETAPredictionModel.ts
```
**Action:** `rm -rf src/intelligence/`

---

### `src/modules/mod4/` (10 files)
Duplicate of code that lives in the separate `/mod4` PWA app.
```
src/modules/mod4/hooks/useDriverSession.ts
src/modules/mod4/hooks/useGPSTracking.ts
src/modules/mod4/hooks/useGeoLocation.ts
src/modules/mod4/index.ts
src/modules/mod4/services/EventExecutionService.ts
src/modules/mod4/services/GPSTrackingService.ts
src/modules/mod4/services/SecurityService.ts
src/modules/mod4/services/SyncManager.ts
src/modules/mod4/storage/Mod4Database.ts
src/modules/mod4/types/events.ts
```
**Action:** `rm -rf src/modules/mod4/` (check if `src/modules/` has other content first)

---

### `src/pwa/` (3 files)
PWA service worker infrastructure — not wired up to the main app.
```
src/pwa/db.ts
src/pwa/serviceWorker.ts
src/pwa/syncQueue.ts
```
**Action:** `rm -rf src/pwa/`

---

### `src/data/` (2 files)
Static mock data, superseded by real Supabase data.
```
src/data/fleet.ts
src/data/warehouses.ts
```
**Action:** `rm -rf src/data/`

---

### `src/demo/` (1 file)
```
src/demo/generateDemoVehicles.ts
```
**Action:** `rm -rf src/demo/`

---

## 2. Dead Pages (40 files)

Old route pages no longer registered in the router.

```
src/pages/CommandCenterPage.tsx
src/pages/Dashboard.tsx
src/pages/DashboardPage.tsx
src/pages/FacilityManager.tsx
src/pages/FacilityManagerPage.tsx
src/pages/Index.tsx
src/pages/OperationalPage.tsx
src/pages/admin/general/page.tsx
src/pages/admin/integration/page-old.tsx          ← explicit "-old" suffix
src/pages/admin/invitations/page.tsx
src/pages/admin/users/[id]/components/UserLoginRights.tsx
src/pages/admin/users/[id]/edit/page.tsx
src/pages/admin/users/[id]/page.tsx
src/pages/admin/users/create/page.tsx
src/pages/admin/users/page.tsx
src/pages/admin/workspaces/[id]/page.tsx
src/pages/admin/workspaces/page.tsx
src/pages/fleetops/batches/page.tsx
src/pages/fleetops/drivers/components/DriverProfileView.tsx
src/pages/map/components/PlaybackAnalytics.tsx
src/pages/map/components/PlaybackMapView.tsx
src/pages/map/components/TimelineControls.tsx
src/pages/map/intelligence/page.tsx
src/pages/map/playback/components/PlaybackCalendar.tsx
src/pages/storefront/facilities/components/FacilityMapPopup.tsx
src/pages/storefront/invoice/components/index.ts
src/pages/storefront/items/components/index.ts
src/pages/storefront/requisitions/CreateRequisitionDialog.tsx
src/pages/storefront/requisitions/RequisitionDetailsDialog.tsx
src/pages/storefront/requisitions/RequisitionTypeDialog.tsx
src/pages/storefront/requisitions/UploadRequisitionDialog.tsx
src/pages/storefront/requisitions/components/BatchSizeWarning.tsx
src/pages/storefront/requisitions/components/CSVTemplateButton.tsx
src/pages/storefront/requisitions/components/FileUploadZone.tsx
src/pages/storefront/requisitions/components/ParsedItemsPreview.tsx
src/pages/storefront/scheduler/components/SchedulerControlBar.tsx
src/pages/storefront/scheduler/components/StatusTabs.tsx
src/pages/storefront/scheduler/components/calendar/index.ts
src/pages/storefront/warehouse/components/index.ts
src/pages/storefront/zones/components/service-areas/ServicePoliciesTab.tsx
```

---

## 3. Dead Components (142 files)

### Map UI graveyard (~80 files)
The old map component system — replaced by `maps-v3/` + `DashboardMapLibre`.
```
src/components/map/dialogs/AnalyticsDialog.tsx
src/components/map/dialogs/PlanningReviewDialog.tsx
src/components/map/dialogs/ScenarioDialog.tsx
src/components/map/dialogs/TradeOffDialog.tsx
src/components/map/DriverLayer.tsx
src/components/map/EventStreamDrawer.tsx
src/components/map/ForensicMapLibre.tsx
src/components/map/HandoffFlowDialog.tsx
src/components/map/layers/AlertsLayer.tsx
src/components/map/layers/DriversLayer.tsx
src/components/map/layers/FacilitiesLayer.tsx
src/components/map/layers/HandoffsLayer.tsx
src/components/map/layers/PayloadLayer.tsx
src/components/map/layers/PerformanceHeatmapLayer.tsx
src/components/map/layers/TradeOffHistoryLayer.tsx
src/components/map/layers/TradeOffRoutesLayer.tsx
src/components/map/layers/VehiclesLayer.tsx
src/components/map/layers/WarehousesLayer.tsx
src/components/map/MapControls.tsx
src/components/map/MapLegend.tsx
src/components/map/MapLoadingSkeleton.tsx
src/components/map/MapSidebar.tsx
src/components/map/OperationalMapLibre.tsx
src/components/map/overlays/BatchDetailsOverlay.tsx
src/components/map/overlays/FacilitySelectionOverlay.tsx
src/components/map/overlays/RouteComparisonOverlay.tsx
src/components/map/overlays/RouteInfoOverlay.tsx
src/components/map/PlanningMapLibre.tsx
src/components/map/PlaybackControls.tsx
src/components/map/RepresentationToggle.tsx
src/components/map/TimelineSlider.tsx
src/components/map/tools/DistanceMeasureTool.tsx
src/components/map/tools/FacilityAssigner.tsx
src/components/map/tools/RouteSketchTool.tsx
src/components/map/tools/ZoneEditor.tsx
src/components/map/TradeOffApproval.tsx
src/components/map/ui/AnalyticsPanel.tsx
src/components/map/ui/ControlRail.tsx
src/components/map/ui/ControlSurface.tsx
src/components/map/ui/DriverInfoCard.tsx
src/components/map/ui/EmptyState.tsx
src/components/map/ui/ExpandableFilterPanel.tsx
src/components/map/ui/FacilityInfoCard.tsx
src/components/map/ui/FilterPopover.tsx
src/components/map/ui/InsightBar.tsx
src/components/map/ui/LayerControl.tsx
src/components/map/ui/MapLegend.tsx
src/components/map/ui/MapModeSwitcher.tsx
src/components/map/ui/MapToolbar.tsx
src/components/map/ui/MapToolsPanel.tsx
src/components/map/ui/MetricsTogglePanel.tsx
src/components/map/ui/ModeIndicator.tsx
src/components/map/ui/PanelDrawer.tsx
src/components/map/ui/PlanningControlBar.tsx
src/components/map/ui/ScenarioPanel.tsx
src/components/map/ui/ThemeToggle.tsx
src/components/map/ui/TimelineScrubber.tsx
src/components/map/ui/VehicleContextPanel.tsx
src/components/map/ui/WarehouseInfoCard.tsx
src/components/map/ZoneLayer.tsx
```

### Admin UI (unused admin panel)
```
src/components/admin/audit/AuditLogTable.tsx
src/components/admin/invitations/index.ts
src/components/admin/invitations/InvitationsList.tsx
src/components/admin/invitations/InviteUserDialog.tsx
src/components/admin/users/RoleSelector.tsx
src/components/admin/users/UserForm.tsx
src/components/admin/users/UserTable.tsx
src/components/admin/workspaces/AddMemberDialog.tsx
src/components/admin/workspaces/MemberList.tsx
src/components/admin/workspaces/WorkspaceTable.tsx
```

### Layout duplicates
```
src/components/auth/AccessDenied.tsx
src/components/layout/CommandPalette.tsx
src/components/layout/Layout.tsx
src/components/layout/PageLayout.tsx
src/components/layout/PageShell.tsx
src/components/layouts/ThreeColumnLayout.tsx
```

### Batch / Cargo / Payload
```
src/components/batches/CreateBatchDialog.tsx
src/components/batches/FacilityMapSelector.tsx
src/components/batches/FacilitySelector.tsx
src/components/batches/index.ts
src/components/batches/VehicleSlotGrid.tsx
src/components/cargo/LoadingPlannerDialog.tsx
src/components/cargo/RequisitionsList.tsx
src/components/cargo/TruckVisualizer.tsx
src/components/payload/PayloadVisualizer.tsx
src/components/storefront/FinalizePayloadDialog.tsx
```

### Driver / Dispatch
```
src/components/driver/DriverLocationMarker.tsx
src/components/driver/DriverStatusPanel.tsx
src/components/driver/DriverVehicleCarousel.tsx
src/components/dispatch/RouteCard.tsx
src/components/dispatch/RouteMapPreview.tsx
```

### VLMS vehicle configurator (old version)
```
src/components/vlms/vehicle-configurator/CategoryTypeSelector.tsx
src/components/vlms/vehicle-configurator/DimensionPayloadInput.tsx
src/components/vlms/vehicle-configurator/PreviewModal.tsx
src/components/vlms/vehicle-configurator/SpecsSummary.tsx
src/components/vlms/vehicle-configurator/TierCountSelector.tsx
src/components/vlms/vehicle-configurator/TierSlotBuilder.tsx
src/components/vlms/vehicle-configurator/VehicleCarousel.tsx
src/components/vlms/vehicle-configurator/VehicleConfigurator.tsx
src/components/vlms/vehicle-configurator/VehicleVisualizer.tsx
src/components/vlms/vehicle-onboarding/CapacityConfigurator.tsx
src/components/vlms/vehicle-onboarding/CategorySelector.tsx
src/components/vlms/vehicle-onboarding/CategoryTile.tsx
src/components/vlms/vehicle-onboarding/RegistrationForm.tsx
src/components/vlms/vehicle-onboarding/SubcategoryCarousel.tsx
src/components/vlms/vehicle-onboarding/TypeCard.tsx
src/components/vlms/vehicle-onboarding/VehicleSubcategoryStep.tsx
src/components/vlms/vehicles/capacity/vehicle-silhouettes/index.ts
src/components/vlms/vehicles/capacity/VehicleCapacityDemo.tsx
src/components/vlms/vehicles/form-sections/BasicInfoSection.tsx
```

### Misc dead components
```
src/components/dashboard/AlertsPanel.tsx
src/components/dashboard/ZoneAlerts.tsx
src/components/debug/DebugPermissions.tsx
src/components/delivery/DeliveryList.tsx
src/components/handoff/EnhancedHandoffManager.tsx
src/components/onboarding/WorkspaceSetupWizard.tsx
src/components/readiness/index.ts
src/components/readiness/ReadinessGate.tsx
src/components/readiness/ReadinessStatus.tsx
src/components/readiness/SetupRequiredPrompt.tsx
src/components/realtime/PayloadTracker.tsx
src/components/shared/WorkspaceSwitcher.tsx
src/components/zones/ZoneManagerAssignment.tsx
```

### Dead shadcn/ui wrappers (components not used anywhere)
```
src/components/ui/aspect-ratio.tsx
src/components/ui/bulk-actions-toolbar.tsx
src/components/ui/carousel.tsx
src/components/ui/checkbox-group.tsx
src/components/ui/context-menu.tsx
src/components/ui/drawer.tsx
src/components/ui/error-state.tsx
src/components/ui/form-field.tsx
src/components/ui/form-section.tsx
src/components/ui/hover-card.tsx
src/components/ui/loading-spinner.tsx
src/components/ui/loading-state.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/resizable.tsx
src/components/ui/search-input.tsx
src/components/ui/unit-input.tsx
src/components/ui/VehicleTable.tsx
src/components/ui/virtual-table.tsx
```

---

## 4. Dead Hooks (46 files)

```
src/hooks/map/index.ts
src/hooks/map/useMapDrivers.ts
src/hooks/map/useMapFacilities.ts
src/hooks/map/useMapRoutes.ts
src/hooks/map/useMapVehicles.ts
src/hooks/map/useMapWarehouses.ts
src/hooks/settings/useCoordinatePolicy.ts
src/hooks/use-query-wrapper.ts
src/hooks/useBatchTierAssignments.tsx
src/hooks/useDebouncedMapData.ts
src/hooks/useDeliverySchedules.tsx
src/hooks/useDrawerState.tsx
src/hooks/useFinalizeBatch.tsx
src/hooks/useH3CellMetrics.ts
src/hooks/useHandoffFlow.tsx
src/hooks/useHandoffs.tsx
src/hooks/useMapPlayback.tsx
src/hooks/useMapRealtime.ts
src/hooks/useMod4Session.ts
src/hooks/useOfflineEventQueue.ts
src/hooks/usePayload.ts
src/hooks/usePayloadItems.ts
src/hooks/usePayloadItems.tsx     ← duplicate of above (.ts)
src/hooks/usePublishToFleetOps.ts
src/hooks/useRealtimeEvents.tsx
src/hooks/useRealtimePayload.tsx
src/hooks/useRealtimeSchedules.tsx
src/hooks/useRequisitionAnalytics.ts
src/hooks/useRequisitionToPayload.tsx
src/hooks/useRouteOptimization.ts
src/hooks/useRouteSketches.ts
src/hooks/useScheduleBatches.tsx
src/hooks/useScheduleExport.ts
src/hooks/useScheduleOptimization.ts
src/hooks/useSchedulerSettings.ts
src/hooks/useScheduleWizard.tsx
src/hooks/useTelemetryData.tsx
src/hooks/useTradeOff.ts
src/hooks/useVehicleCategories.tsx
src/hooks/useVehicleConfiguratorStore.ts
src/hooks/useVirtualizedMapData.ts
src/hooks/useWorkspaceReadiness.ts
src/hooks/useZoneAlerts.tsx
src/hooks/useZoneConfigurations.ts
src/hooks/useZoneDrawing.tsx
```

---

## 5. Dead Library Files (28 files)

```
src/integrations/supabase/h3Analytics.ts
src/lib/admin-units-cleaners.ts
src/lib/algorithms/clustering.ts
src/lib/capacity/slotAssignmentEngine.ts
src/lib/capacity/slotMapper.ts
src/lib/csvParser.ts
src/lib/env.ts
src/lib/error-handler.ts
src/lib/errorHandler.ts           ← duplicate of error-handler.ts
src/lib/excelParser.ts
src/lib/exportUtils.ts
src/lib/geofabrik-boundaries.ts
src/lib/handoffManagement.ts
src/lib/logger.ts
src/lib/mapAccessControl.ts
src/lib/mapAuditLogger.ts
src/lib/mapIcons.ts
src/lib/mapInteractionAnalytics.ts
src/lib/mapStateMachine.ts
src/lib/mockRouteData.ts
src/lib/payloadValidation.ts
src/lib/unitConversions.ts
src/lib/validationSchemas.ts
src/lib/validations/vehicle.ts
src/lib/vlms/__tests__/capacityCalculations.test.ts
src/lib/vlms/defaultVehicleConfigs.ts
src/lib/vlms/tierValidation.ts
src/lib/vlms/vehicleClassConstraints.ts
src/lib/vlms/vehicleSilhouettes.ts
src/models/planning.ts
src/services/h3Planner.ts
src/stores/filtersStore.ts
src/styles/globals.css
src/types/env.d.ts
src/App.css
```

---

## 6. Unused npm Packages to Remove

### `dependencies` (production, adds to bundle)
```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
@geoapify/geocoder-autocomplete
@mapbox/mapbox-gl-draw
@radix-ui/react-aspect-ratio
@radix-ui/react-context-menu
@radix-ui/react-hover-card
@radix-ui/react-menubar
@radix-ui/react-navigation-menu
@types/axios             ← @types should be devDependency anyway
@types/json2csv          ← same
axios
caniuse-lite
embla-carousel-react
h3-js
idb
json2csv
jspdf-autotable
pg
phosphor-react
react-map-gl
react-resizable-panels
vaul
workbox-core
workbox-precaching
workbox-routing
workbox-strategies
```

### `devDependencies`
```
@tailwindcss/typography
@types/maplibre-gl
dotenv
shadcn
supabase              ← verify: may want to keep for CLI usage
```

### Unlisted dependency (in code but not in package.json)
```
leaflet.markercluster   — imported in src/main.tsx (CSS only)
```
Either add it to package.json or remove the import if leaflet is no longer used.

---

## Recommended Deletion Order

1. **Safe, no-risk:** `archive/`, `src/fleetops/`, `src/intelligence/`, `src/pwa/`, `src/data/`, `src/demo/`, `src/modules/mod4/`
2. **Dead pages:** All 40 pages listed above
3. **Dead hooks + lib files:** All 46 hooks + 28 lib files
4. **Dead components:** Confirm each group (map UI is clearly dead; admin UI — verify if any admin routes are still planned)
5. **npm packages:** Run `npm uninstall <packages>` after file deletion

> ⚠️ Confirm before running batch deletes. Some hooks/components flagged here may be used from other branches or planned features. Cross-check against your router (`src/App.tsx`) to validate page deletions.
