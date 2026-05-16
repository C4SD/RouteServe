import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Color palette for facility types
const FACILITY_TYPE_COLORS: Record<string, string> = {
  hospital: '#EF4444', // red
  clinic: '#3B82F6', // blue
  pharmacy: '#10B981', // green
  'health center': '#8B5CF6', // purple
  'medical center': '#F59E0B', // amber
  default: '#6B7280', // gray
};

// Helper to get facility color
const getFacilityColor = (type: string): string => {
  const lowerType = type.toLowerCase();
  for (const [key, color] of Object.entries(FACILITY_TYPE_COLORS)) {
    if (lowerType.includes(key)) return color;
  }
  return FACILITY_TYPE_COLORS.default;
};

export const MapIcons = {
  /**
   * Facility marker with type-based coloring
   */
  facility: (selected = false, type = 'default') => {
    const color = getFacilityColor(type);
    const size = selected ? 28 : 24;
    const borderWidth = selected ? 3 : 2;
    const boxShadow = selected 
      ? `0 4px 12px rgba(0,0,0,0.4), 0 0 0 3px ${color}40`
      : '0 2px 6px rgba(0,0,0,0.3)';
    
    return L.divIcon({
      html: `
        <div style="
          background: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: ${borderWidth}px solid white;
          box-shadow: ${boxShadow};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          ${selected ? 'transform: scale(1.2);' : ''}
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      className: 'facility-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  },
  
  /**
   * Warehouse marker
   */
  warehouse: (selected = false) => {
    const size = selected ? 28 : 24;
    const innerSize = selected ? 12 : 10;
    const borderWidth = selected ? 3 : 2;
    const boxShadow = selected 
      ? '0 4px 12px rgba(0,120,150,0.5), 0 0 0 3px rgba(0,120,150,0.2)'
      : '0 2px 8px rgba(0,120,150,0.3)';
    
    return L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, #0078A0 0%, #006080 100%);
          border: ${borderWidth}px solid white;
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: ${boxShadow};
          ${selected ? 'transform: scale(1.2);' : ''}
        ">
          <div style="
            background: white;
            width: ${innerSize}px;
            height: ${innerSize}px;
            border-radius: 50%;
          "></div>
        </div>
      `,
      className: 'warehouse-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  },
  
  driver: (status: 'available' | 'busy' | 'offline', initials: string, isActive = false) => {
    const statusColors = {
      available: 'hsl(142 76% 36%)',
      busy: 'hsl(38 92% 50%)',
      offline: 'hsl(240 3.8% 46.1%)'
    };
    
    const bgColor = statusColors[status];
    const pulseAnimation = isActive ? `
      @keyframes pulse-driver {
        0%, 100% { box-shadow: 0 0 0 0 ${bgColor}80; }
        50% { box-shadow: 0 0 0 8px ${bgColor}00; }
      }
    ` : '';
    
    return L.divIcon({
      html: `
        <style>${pulseAnimation}</style>
        <div style="
          background-color: ${bgColor};
          border: 3px solid hsl(0 0% 100%);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 10px -2px ${bgColor}80;
          font-weight: 600;
          color: white;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          ${isActive ? `animation: pulse-driver 2s infinite;` : ''}
        ">
          ${initials}
        </div>
      `,
      className: 'driver-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  },
  
  /**
   * Waypoint marker for route stops
   */
  waypoint: (number: number, isStart = false, isEnd = false) => {
    const size = 32;
    const bgColor = isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6';
    const label = isStart ? 'S' : isEnd ? 'E' : number.toString();
    
    return L.divIcon({
      html: `
        <div style="
          background: white;
          border: 3px solid ${bgColor};
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: ${bgColor};
          font-size: 14px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          ${label}
        </div>
      `,
      className: 'waypoint-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  },

  /**
   * Vehicle marker with payload capacity ring
   */
  vehicle: (
    payloadPct: number = 0, 
    selected: boolean = false,
    status: 'available' | 'busy' | 'offline' | 'maintenance' = 'available'
  ) => {
    const ringColor = 
      payloadPct > 90 ? 'hsl(0 72% 51%)' :
      payloadPct > 60 ? 'hsl(38 92% 50%)' :
      'hsl(142 76% 36%)';
    
    const statusColor = {
      available: 'hsl(142 76% 36%)',
      busy: 'hsl(38 92% 50%)',
      offline: 'hsl(215 20% 65%)',
      maintenance: 'hsl(266 83% 67%)',
    }[status];
    
    const circumference = 2 * Math.PI * 18;
    const strokeDasharray = `${(payloadPct / 100) * circumference} ${circumference}`;
    
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center" style="width: 44px; height: 44px;">
          ${payloadPct > 0 ? `
            <svg width="44" height="44" class="absolute inset-0" style="transform: rotate(-90deg);">
              <circle 
                cx="22" 
                cy="22" 
                r="18" 
                fill="none" 
                stroke="${ringColor}" 
                stroke-width="4" 
                stroke-dasharray="${strokeDasharray}"
                stroke-linecap="round"
              />
            </svg>
          ` : ''}
          <div class="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-md border-2 border-white ${selected ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}" 
            style="background: ${statusColor};">
            🚚
          </div>
        </div>
      `,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });
  },

  /**
   * Handoff point marker
   */
  handoffPoint: (status: 'planned' | 'pending' | 'completed' | 'cancelled' = 'pending') => {
    const statusColor = {
      planned: 'hsl(215 20% 65%)',
      pending: 'hsl(38 92% 50%)',
      completed: 'hsl(142 76% 36%)',
      cancelled: 'hsl(0 72% 51%)',
    }[status];
    
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-md border-2 border-white" 
            style="background: ${statusColor};">
            🤝
          </div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  },
};
