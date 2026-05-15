# RouteServe - Comprehensive Fleet Management System

<div align="center">

![Log4 Logo](./public/favicon.svg)

**Enterprise-grade fleet management and logistics platform**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3+-646CFF.svg)](https://vitejs.dev/)

</div>

## Overview

RouteServe is a modern, comprehensive fleet management system designed to optimize logistics operations through intelligent workspace-based architecture. Built with cutting-edge web technologies, it provides real-time tracking, vehicle lifecycle management, payload optimization, and advanced analytics.

### Key Features

- **Multi-Workspace Architecture**: Specialized interfaces for different operational roles
- **Real-Time Fleet Tracking**: Live GPS monitoring with historical playback
- **Vehicle Lifecycle Management**: Comprehensive VLMS (Vehicle Lifecycle Management System)
- **Intelligent Route Optimization**: AI-powered delivery planning and scheduling
- **Advanced Analytics**: Comprehensive reporting and business intelligence
- **Role-Based Access Control**: Granular permissions and workspace management
- **Mobile-First Driver Experience**: Dedicated mobile workspace for field operations

## Architecture

### Workspace-Based Design

Log4 organizes functionality into specialized workspaces, each tailored to specific operational needs:

#### **FleetOps** 
*Fleet Operations & Management*
- Vehicle registry and detailed tracking
- Driver management and assignment
- Batch delivery management
- VLMS integration (maintenance, fuel, inspections)
- Tactical operations and dispatch

#### **Storefront** 
*Logistics Planning & Coordination*
- Facility and warehouse management
- Requisition and order processing
- Zone-based delivery planning
- Inventory and stock management
- Program and service coordination

#### **Mod4** 
*Mobile Driver Execution*
- Driver dashboard and active deliveries
- Real-time delivery tracking
- Session management
- Field operations support

#### **Map** 
*Geospatial Intelligence*
- Live fleet tracking
- Historical route playback
- Geographic analytics
- Location-based insights

#### **Admin** 
*System Administration*
- User and workspace management
- System configuration
- Integration management
- Analytics and reporting

## Technology Stack

### Frontend
- **React 18.3+** - Modern UI framework with hooks and concurrent features
- **TypeScript 5.8+** - Type-safe development experience
- **Vite 7.3+** - Lightning-fast build tool and dev server
- **React Router 6.30+** - Client-side routing with lazy loading
- **React Query 5.83+** - Server state management and caching

### UI & Design System
- **BIKO Design System** - Custom design system with operational minimalism
- **Shadcn/UI + Radix** - Accessible component library
- **TailwindCSS 3.4+** - Utility-first styling framework
- **Lucide React** - Comprehensive icon library

### Mapping & Geospatial
- **Leaflet.js** - Interactive maps with clustering
- **MapLibre GL** - Advanced vector mapping
- **H3.js** - Hexagonal geospatial indexing
- **Geoapify** - Geocoding and address search

### Backend & Database
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Edge Functions** - Serverless compute for AI and routing
- **Realtime Subscriptions** - Live data synchronization
- **Row Level Security** - Fine-grained data access control

### Development & Testing
- **Playwright** - End-to-end testing
- **ESLint** - Code quality and consistency
- **TypeScript ESLint** - Type-aware linting
- **PWA Support** - Progressive Web App capabilities

## Quick Start

### Prerequisites

- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/f4falalu/log4.git
cd log4

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Map Services
VITE_GEOAPIFY_API_KEY=your_geoapify_api_key

# Optional: Analytics and Monitoring
VITE_ANALYTICS_ID=your_analytics_id
```

## Project Structure

```
src/
components/           # Reusable UI components
  admin/           # Admin-specific components
  auth/            # Authentication components
  batches/         # Delivery batch components
  ui/              # Base UI components (shadcn)
contexts/            # React contexts for state management
pages/               # Route-based page components
  fleetops/        # Fleet operations workspace
  storefront/      # Logistics planning workspace
  mod4/           # Mobile driver workspace
  map/            # Mapping and tracking
  admin/          # System administration
  settings/       # Application settings
rbac/               # Role-based access control
data/               # Static data and configurations
hooks/              # Custom React hooks
```

## Testing

```bash
# Run end-to-end tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui

# Run linting
npm run lint
```

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup

The application supports multiple deployment environments:

- **Development**: Local development with hot reload
- **Staging**: Preview deployments for testing
- **Production**: Optimized build with PWA features

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright tests |
| `npm run generate:sprites` | Generate map sprites |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the BIKO Design System for UI consistency
- Use TypeScript strictly - no `any` types allowed
- Write meaningful commit messages following [Conventional Commits](https://conventionalcommits.org/)
- Add tests for new features
- Ensure all linting rules pass

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [Project Wiki](https://github.com/f4falalu/log4/wiki)
- **Issues**: [GitHub Issues](https://github.com/f4falalu/log4/issues)
- **Discussions**: [GitHub Discussions](https://github.com/f4falalu/log4/discussions)

## Roadmap

### Version 2.0
- [ ] Advanced AI-powered route optimization
- [ ] Enhanced mobile driver experience
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant architecture

### Version 2.1
- [ ] IoT sensor integration
- [ ] Predictive maintenance
- [ ] Fuel optimization algorithms
- [ ] Enhanced reporting capabilities

---

<div align="center">
Built with by the Log4 Team
</div>
