# baby-go-services

NestJS (TypeScript) API for the BBGO mobile app (`../bbgo`). MongoDB via
Mongoose. Package manager is `yarn` (yarn.lock is the lockfile actually kept
current; package-lock.json/npm both also work but prefer yarn for installs).

Default branch is **`master`**, not `main` — every script and doc in this
repo's `claude_tasks/` pipeline uses `master` as the base/integration branch.

## Structure

- `src/main.ts`, `src/app.module.ts` — Nest bootstrap and root module.
- `src/auth/` — auth module: controller/service, `dto/`, `guards/`,
  `strategies/` (JWT via `@nestjs/passport`/`passport-jwt`), user +
  refresh-token Mongoose schemas.
- `src/contexts/` — domain modules, each roughly a bounded context:
  - `client/` (incl. `search/`) — consumer-facing app surface.
  - `provider/` — provider-facing surface: `bundle/`, `product/`, `store/`.
  - `payments/` — Stripe-backed payments (`dto/`).
  - `settings/` — app/config settings (`dto/`, `seeds/`).
- `src/shared/` — cross-context integrations: `mail/` (Resend),
  `storage/` (Cloudinary), `stripe/`, `twilio/`.
- `src/common/` — `decorators/`, `constants/` used across modules.
- `src/config/` — `@nestjs/config`-based env loading/typing
  (`configuration.ts`, `env.service.ts`, `env.types.ts`).
- `test/` — Jest e2e tests (`test/jest-e2e.json`); unit specs live next to
  their source as `*.spec.ts` under `src/`.
- `docs/` — hand-written reference docs (e.g. Postman collection notes).
- `postman/` — Postman collection/environment files for manual API testing.

## Commands

- `yarn start:dev` — Nest in watch mode (real dev server; don't run this
  from a worktree with symlinked `node_modules`, see `claude_tasks/README.md`).
- `yarn build` — `nest build`.
- `yarn test` / `yarn test:e2e` / `yarn test:cov` — Jest unit / e2e / coverage.
- `yarn lint` — ESLint with `--fix`.
- `yarn format-check` — Prettier check (no native bindings, safe everywhere).
- `yarn check-pipelines` — format + format-check + lint + build, the closest
  thing to this repo's CI gate; run it before calling a task done.

## Task pipeline

This repo has a Trello-driven, worktree-per-task pipeline mirroring `../bbgo`'s.
See `claude_tasks/README.md` for the full mechanics.
