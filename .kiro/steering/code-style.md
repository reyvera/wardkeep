# Code Style Guidelines

inclusion: auto

## Language and Formatting

- TypeScript strict mode everywhere. No `any` types — use `unknown` and narrow.
- Prettier handles formatting (defaults: 2-space indent, single quotes, trailing commas, 100 char line width).
- ESLint with `@typescript-eslint/recommended` and NestJS/React recommended plugins.

## Naming Conventions

- **Files and folders:** kebab-case (`user-settings.service.ts`, `debt-calculator.ts`)
- **Classes:** PascalCase (`AccountService`, `TransactionController`)
- **Interfaces:** PascalCase with `I` prefix only for DI tokens; otherwise plain names (`Account`, `ParseResult`)
- **Functions and variables:** camelCase (`calculateBalance`, `userId`)
- **Constants:** UPPER_SNAKE_CASE for true constants (`MAX_ACCOUNTS_PER_USER = 50`)
- **Enums:** PascalCase enum name, UPPER_SNAKE_CASE values (`enum AccountType { CHECKING, SAVINGS }`)
- **Database columns:** snake_case via Prisma `@map` (TypeScript stays camelCase)

## Import Ordering

1. Node built-ins (`node:crypto`, `node:path`)
2. External packages (`@nestjs/*`, `react`, `decimal.js`)
3. Internal packages (`@wardkeep/shared`, `@wardkeep/finance-engine`)
4. Relative imports (`./`, `../`)

Blank line between each group.

## Module Structure (NestJS)

Each module follows:
```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
├── entities/          (if needed beyond Prisma)
└── module-name.spec.ts
```

## Component Structure (Next.js)

- App Router (`app/` directory) for pages
- Shared components in `components/` with one component per file
- Hooks in `hooks/` directory
- Client components must have `'use client'` directive at top

## General Rules

- No default exports (except Next.js pages/layouts which require them)
- Prefer named exports
- Prefer `const` over `let`; never use `var`
- Functions over classes where no state is needed (especially in finance-engine)
- Use Decimal.js for ALL currency/financial calculations — never native `number`
- All public functions must have JSDoc with `@param` and `@returns`
- Maximum file length: 300 lines. Split if larger.
- No magic numbers — extract to named constants in `packages/shared/constants`
