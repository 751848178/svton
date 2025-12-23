# Svton Framework

> Full-stack application framework with CLI, packages, and templates

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Svton is a comprehensive full-stack application framework that provides:

- **CLI Tool** (`svton`) - Create new projects with a single command
- **Shared Packages** - Reusable libraries for API client, hooks, and UI components
- **Templates** - Production-ready templates for backend, admin, and mobile apps
- **Documentation** - Comprehensive guides and architecture docs

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `svton` | CLI tool for creating projects | [![npm](https://img.shields.io/npm/v/svton.svg)](https://www.npmjs.com/package/svton) |
| `@svton/api-client` | TypeScript-first API client | [![npm](https://img.shields.io/npm/v/@svton/api-client.svg)](https://www.npmjs.com/package/@svton/api-client) |
| `@svton/hooks` | React hooks collection | [![npm](https://img.shields.io/npm/v/@svton/hooks.svg)](https://www.npmjs.com/package/@svton/hooks) |
| `@svton/taro-ui` | Taro UI components | [![npm](https://img.shields.io/npm/v/@svton/taro-ui.svg)](https://www.npmjs.com/package/@svton/taro-ui) |

## Quick Start

```bash
# Create a new project
npx svton create my-app

# Or install globally
npm install -g svton
svton create my-app
```

## Templates

- **Full Stack** - Backend (NestJS) + Admin (Next.js) + Mobile (Taro)
- **Backend Only** - NestJS + Prisma + MySQL + Redis
- **Admin Only** - Next.js + TailwindCSS + shadcn/ui
- **Mobile Only** - Taro + React (WeChat Mini Program)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev

# Run tests
pnpm test
```

## Project Structure

```
svton/
├── packages/
│   ├── cli/              # svton CLI tool
│   ├── api-client/       # @svton/api-client
│   ├── hooks/            # @svton/hooks
│   └── taro-ui/          # @svton/taro-ui
├── templates/
│   ├── apps/
│   │   ├── admin/        # Next.js admin template
│   │   ├── backend/      # NestJS backend template
│   │   └── mobile/       # Taro mobile template
│   └── packages/
│       └── types/        # Types package template
├── docs/                 # Documentation
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [SVTON Team](https://github.com/svton)
