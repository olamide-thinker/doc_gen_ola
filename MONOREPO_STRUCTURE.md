# Construction PM Monorepo Structure

Successfully refactored the application into a monorepo architecture. This enables modular development where each module can be useful standalone.

## Directory Structure

```
project-root/
├── packages/
│   ├── shared/                  # Shared code (types, hooks, components, utils)
│   │   ├── types/               # Shared type definitions (Task, Receipt, Invoice, etc.)
│   │   ├── components/          # Reusable UI components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Utility functions (calculations, formatting, etc.)
│   │   ├── context/             # React context providers
│   │   └── package.json         # Shared package config
│   │
│   └── accounting-app/          # Accounting Module (Invoice/Receipt management)
│       ├── src/                 # React source code
│       ├── public/              # Static assets
│       ├── dist/                # Build output
│       ├── package.json         # App-specific config
│       ├── tsconfig.json        # TypeScript config
│       ├── vite.config.ts       # Vite build config
│       └── index.html           # HTML entry point
│
├── backend/                     # Backend services
│
├── package.json                 # Root workspace config (defines workspaces)
├── tsconfig.json                # Root TypeScript config
└── node_modules/                # Installed dependencies (shared)
```

## Key Files

**Root package.json**
- Defines workspaces: `packages/*` and `backend`
- Contains shared dependencies for all packages
- Provides convenience scripts for development

**packages/shared/package.json**
- Exports named entry points for types, components, hooks, utils, context
- Will be used by other modules via `@construction-pm/shared`

**packages/accounting-app/package.json**
- Depends on `@construction-pm/shared`
- Has its own build config (Vite)

## NPM Scripts

**Root level:**
- `npm run dev` - Start accounting app + backend in parallel
- `npm run build` - Build accounting app
- `npm run build:all` - Build all packages
- `npm run type-check` - Run TypeScript validation
- `npm run lint` - Lint all packages

**Individual packages:**
- `npm --prefix packages/accounting-app run dev` - Dev server for accounting app only
- `npm --prefix packages/shared run build` - Build shared package

## Next Steps

### To add a new module (e.g., Project Scope):
1. Create `packages/project-scope/` directory
2. Add `package.json` with dependency on `@construction-pm/shared`
3. Copy config files (vite.config.ts, tsconfig.json, index.html)
4. Implement module-specific components in `src/`
5. Add entry script to root `package.json`

### To extract shared code:
1. Move reusable components to `packages/shared/components/`
2. Export from `packages/shared/components/index.ts`
3. Update imports in consuming packages to use `@construction-pm/shared/components`

### Build Configuration:
- Each package can have its own Vite/build setup
- Or use a shared Vite config (to be added to packages/shared/)
- Root workspace coordinates builds and dependencies

## Current Status

✅ Monorepo structure created  
✅ Accounting app moved to packages/accounting-app/  
✅ Shared package created at packages/shared/  
✅ TypeScript validation passes  
✅ Build successful  
✅ Dev server working  

All functionality from the original single-app setup is preserved and working.

## Installation & Development

```bash
# Install all dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```
