# CrickIQ - Cricket Team Management System

## Overview

CrickIQ is a comprehensive cricket team management platform built with a modern full-stack architecture. The application provides tools for managing cricket teams, players, matches, payments, and performance analytics. It features dual authentication systems (Replit Auth and traditional email/password), real-time match scoring, player availability tracking, and financial management capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom cricket-themed color palette
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (Neon serverless for production)
- **Session Management**: Express-session with PostgreSQL store
- **Email Service**: SendGrid for transactional emails
- **Authentication**: Dual system supporting both Replit Auth and local credentials

### Database Design
The system uses a comprehensive PostgreSQL schema with the following key entities:
- **Users**: Both Replit Auth users and local email/password users
- **Teams**: Team management with hierarchical structure
- **Players**: Player profiles with cricket-specific attributes
- **Matches**: Complete match lifecycle management
- **Innings/Balls**: Detailed ball-by-ball scoring system
- **Payments/Invoices**: Financial management for teams
- **Availability**: Player availability tracking system

## Key Components

### Authentication System
- **Dual Authentication**: Supports both Replit Auth (OpenID Connect) and traditional email/password
- **Role-Based Access**: Admin, organizer, and player roles with different permissions
- **Session Management**: Persistent sessions with PostgreSQL storage
- **Password Reset**: Secure token-based password recovery via email

### Cricket Management Features
- **Live Scoring**: Real-time ball-by-ball match scoring
- **Team Management**: Hierarchical team organization with player assignments
- **Player Statistics**: Comprehensive performance tracking
- **Match Scheduling**: Complete match lifecycle from scheduling to completion
- **Availability Requests**: Player availability polling for matches

### Financial Management
- **Payment Tracking**: Track player payments for matches and fees
- **Invoice Generation**: Automated invoice creation and management
- **Corporate Integration**: Support for corporate sponsors and invoicing

### Communication System
- **Email Notifications**: SendGrid integration for team invitations and notifications
- **Player Invitations**: Streamlined player onboarding process
- **Availability Requests**: Automated availability polling

## Data Flow

### Authentication Flow
1. User accesses application
2. System checks for existing session
3. If authenticated, loads user data and role-based permissions
4. Redirects to appropriate dashboard (admin vs player view)

### Match Management Flow
1. Admin creates match and sends availability requests
2. Players respond to availability requests
3. Admin confirms team selection
4. Live scoring during match execution
5. Post-match statistics and payment processing

### Payment Processing Flow
1. Admin creates payment requests for players
2. System generates invoices and notifications
3. Payment status tracking and reconciliation
4. Automated reminders for overdue payments

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **@sendgrid/mail**: Email service integration
- **bcrypt**: Password hashing and security
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation
- **@hookform/resolvers**: Zod integration for form validation
- **zod**: Schema validation library
- **tailwindcss**: Utility-first CSS framework
- **@radix-ui/***: Accessible UI component primitives

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type safety and development experience
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server on port 5000
- **Database**: Local PostgreSQL or Neon development instance
- **Hot Reloading**: Automatic code reloading during development

### Production Environment
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Deployment Target**: Replit autoscale deployment
- **Database**: Neon PostgreSQL serverless
- **Session Storage**: PostgreSQL-backed sessions for scalability
- **Static Assets**: Served through Express with optimized caching

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string
- **SESSION_SECRET**: Session encryption key
- **SENDGRID_API_KEY**: Email service authentication
- **ISSUER_URL**: OpenID Connect issuer for Replit Auth
- **NODE_ENV**: Environment mode (development/production)

## Changelog

Changelog:
- June 14, 2025. Initial setup
- June 14, 2025. Redesigned Live Scoring interface to match CricHQ-style mobile-first design with prominent score display, touch-friendly controls, and visual ball tracking

## User Preferences

Preferred communication style: Simple, everyday language.