# Gaeliza frontend v2

React + TypeScript + Vite frontend for the Gaeliza v2 rewrite.

## Current architecture

The new application lives under `src/v2` and is the only application code included by `tsconfig.app.json` and ESLint.

The older frontend files remain temporarily in `src` as implementation reference while the rewrite advances, but they are not imported by the v2 entrypoint and are not part of the TypeScript build.

The v2 entrypoint is `src/main.tsx`.

## Environment

Copy `.env.example` to `.env.local` and configure a **v2 Supabase project**:

```dotenv
VITE_GAELIZA_V2_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

A legacy anon key can temporarily be used with:

```dotenv
VITE_GAELIZA_V2_SUPABASE_ANON_KEY=your_legacy_anon_key
```

The generic legacy variables (`VITE_SUPABASE_URL`, etc.) are deliberately ignored by the v2 application. This prevents an old local `.env` from accidentally pointing the rewrite at the legacy Gaeliza database.

Never expose a `service_role` or secret Supabase key through a `VITE_*` variable: Vite variables are shipped to the browser.

## Authentication model

Routes under `/app` require a Supabase session. If no session exists, Gaeliza creates an Anonymous Auth user through `signInAnonymously()`.

This gives guest work a real `auth.uid()` from the first write, allowing RLS ownership to work normally. The product will later link that same identity to email/password or Google rather than copying guest-owned rows into a different user.

Anonymous Auth must be enabled on the target v2 Supabase project before `/app` can be used.

## Routes

- `/` — public landing page
- `/app` — authenticated/guest workspace
- `/app/new` — analysis creation flow
- `/app/analyses/:analysisId` — analysis workspace

## Development

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

GitHub Actions runs both checks for v2 frontend changes.

## Backend boundary

The v2 frontend talks directly to Supabase under RLS and uses database RPCs for transactional operations such as `create_analysis()` and `log_event()`.

The old FastAPI backend and Vite `/api` proxy are not part of v2.
