# rag_agent_server

## Installation

Install dependencies with:

```bash
npm install --legacy-peer-deps
```

### Why `--legacy-peer-deps`?

This project uses `zod@^4` together with `@langchain/community`. `@langchain/community` transitively depends on `@browserbasehq/stagehand`, which pins `zod@^3.23.8` as a peer dependency. npm's strict peer-dependency resolver (npm v7+) refuses to install this combination and fails with `ERESOLVE`.

Passing `--legacy-peer-deps` tells npm to use the older (npm v6) behavior and skip strict peer-dependency checks. The installed code works correctly at runtime because the conflict is only in the peer-dep metadata, not in actual API usage.

The same flag is required when adding new packages, e.g.:

```bash
npm install <package> --legacy-peer-deps
```

To avoid repeating the flag, you can persist it by creating a `.npmrc` file in this directory with:

```
legacy-peer-deps=true
```
