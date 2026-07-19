# React Compose UI

React Compose UI is a Bun monorepo for embeddable low-code editor and preview
components. The current baseline establishes package boundaries, build outputs,
tests, CI, and release automation; it intentionally does not include a document
model or editing behavior yet.

## Workspaces

- `app` — private Vite integration example
- `@compose-ui/core` — React-free shared primitives
- `@compose-ui/editor` — embeddable React editor entrypoint
- `@compose-ui/preview` — embeddable React preview entrypoint

`editor` and `preview` depend on `core` and remain independent from each other.

## Development

Requires Bun 1.3.14.

```bash
bun install --frozen-lockfile
bun run dev
```

The main quality commands are:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
bun run pack:dry-run
```

## Releases

All three public packages use synchronized versions through Changesets. Add a
changeset with `bun run changeset`; merges to `main` update the release pull
request, and merging that pull request publishes the packages to npm.
