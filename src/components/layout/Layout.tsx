import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  MapPin, 
  Building, 
  BarChart3,
  Truck,

  Package,
  User,
  FileText,
  Map
} from 'lucide-react';
import { UserMenu } from './UserMenu';
import { NotificationCenter } from './NotificationCenter';
import { usePermissions, Permission } from '@/hooks/usePermissions';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { hasPermission } = usePermissions();
  const location = useLocation();

  // Define all navigation items with their routes and permissions
  const navigationItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      icon: BarChart3,
      permission: null
    },
    { 
      path: '/command-center', 
      label: 'Command Center', 
      icon: MapPin,
      permission: 'view_batches' as Permission
    },
    { 
      path: '/tactical', 
      label: 'Tactical Map', 
      icon: Map,
      permission: 'view_tactical_map' as Permission
    },
    { 
      path: '/facilities', 
      label: 'Facilities', 
      icon: Building,
      permission: 'manage_facilities' as Permission
    },
    { 
      path: '/drivers', 
      label: 'Drivers', 
      icon: User,
      permission: null
    },
    { 
      path: '/vehicles', 
      label: 'Vehicles', 
      icon: Truck,
      permission: 'manage_vehicles' as Permission
    },
    { 
      path: '/reports', 
      label: 'Reports', 
      icon: FileText,
      permission: 'view_reports' as Permission
    },
  ];

  // Filter navigation items based on user permissions
  const visibleNavItems = navigationItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gradient-light">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-medical rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">RouteServe</h1>
                <p className="text-sm text-muted-foreground">Fleet & Warehouse Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    isActive(item.path)
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;