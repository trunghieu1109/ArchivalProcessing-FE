# Vite shadcn Template

A root-level Vite + React + TypeScript template with shadcn/ui, Tailwind CSS, ESLint, Prettier, and a feature-oriented source structure.

## Stack

- Vite 7
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- ESLint
- Prettier

## Requirements

Use Node.js 20.19+ or 22.12+.

```bash
node --version
npm --version
```

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Docker

Copy the sample environment file and adjust the backend target when needed:

```bash
cp .env.sample .env
```

Build and run the production frontend container:

```bash
docker compose up --build
```

By default the app is exposed at `http://127.0.0.1:5173` and Nginx proxies browser calls from `/api/*` to `ARCHIVAL_API_PROXY_PASS`. Keep `VITE_ARCHIVAL_API_BASE_URL=/api` when using the bundled Nginx reverse proxy.

## Scripts

```bash
npm run dev        # Start the Vite dev server
npm run build      # Type-check and build for production
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript without emitting files
npm run format     # Format TypeScript and TSX files
npm run preview    # Preview the production build
```

## Project structure

```text
vite-shadcn-template/
├── public/                 # Static assets served directly by Vite
├── src/                    # Application source code
│   ├── app/                # App composition layer
│   │   ├── routes/         # Route config, route guards, route constants
│   │   ├── providers/      # ThemeProvider, QueryProvider, AuthProvider, etc.
│   │   ├── layouts/        # MainLayout, AuthLayout, DashboardLayout
│   │   └── App.tsx         # Root React component
│   ├── pages/              # Route-level page components
│   ├── features/           # Business/domain feature modules
│   │   └── <feature>/
│   │       ├── components/ # Components used only by this feature
│   │       ├── api/        # Feature API calls and request helpers
│   │       ├── hooks/      # Feature-specific React hooks
│   │       ├── types/      # Feature-specific TypeScript types
│   │       └── utils/      # Optional feature-only utilities
│   ├── shared/             # Code shared across multiple features
│   │   ├── components/     # Shared non-shadcn components
│   │   ├── api/            # Base API client, interceptors, shared API types
│   │   ├── hooks/          # Generic reusable hooks
│   │   ├── lib/            # Generic utilities
│   │   └── types/          # Shared TypeScript types
│   ├── components/
│   │   └── ui/             # shadcn/ui primitives only
│   ├── styles/             # Global CSS and Tailwind entry styles
│   └── main.tsx            # Vite React entry point
├── components.json         # shadcn/ui configuration
├── eslint.config.js        # ESLint configuration
├── index.html              # Vite HTML entry point
├── package.json            # Scripts and dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Code placement guide

- Use `src/app/` for application composition: providers, layouts, routing setup, and root app wiring.
- Use `src/pages/` for route-level screens.
- Use `src/features/<feature>/` for domain-specific components, hooks, API helpers, types, and utilities.
- Use `src/shared/` for reusable code that is not tied to one feature.
- Use `src/components/ui/` only for shadcn/ui primitives.
- Use `src/styles/globals.css` for Tailwind imports, theme tokens, and global styles.

## shadcn/ui aliases

The template uses these aliases in `components.json`:

```json
{
  "components": "@/components",
  "hooks": "@/shared/hooks",
  "lib": "@/shared/lib",
  "utils": "@/shared/lib/utils",
  "ui": "@/components/ui"
}
```

Use `@/shared/lib/utils` for shared utilities such as `cn`, and keep generated UI primitives in `src/components/ui/`.

## Installing shadcn/ui components

Run the shadcn CLI from the project root:

```bash
npx shadcn@latest add card
```

Install multiple components at once:

```bash
npx shadcn@latest add card input label form
```

New primitives are generated into `src/components/ui/` using the aliases in `components.json`.

Example usage after installing `card`:

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ExampleCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello shadcn</CardTitle>
      </CardHeader>
      <CardContent>This card was added with shadcn/ui.</CardContent>
    </Card>
  )
}
```

If the CLI asks about overwriting files, only accept when you intentionally want to replace the existing component.

After adding components, validate the project:

```bash
npm run typecheck
npm run lint
npm run build
```

## Creating a new project from this template

```bash
git clone <template-repo-url> my-app
cd my-app
rm -rf .git
git init
npm install
npm run dev
```

Then update `name` in `package.json` and replace the starter UI in `src/app/App.tsx`.

## Validate before shipping

```bash
npm run typecheck
npm run lint
npm run build
```
