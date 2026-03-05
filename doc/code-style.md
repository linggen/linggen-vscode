---
type: spec
guide: |
  Product specification — describe what the system should do and why.
  Keep it brief. Aim to guide design and implementation, not document code.
  Avoid implementation details like function signatures, variable types, or code snippets.
---

# Code Style Specification

This document applies to the linggen-vscode TypeScript/React codebase.
It follows the same principles as the Rust code style in linggen, adapted for TypeScript.

## Goals

- Keep code easy to read, maintain, and refactor.
- Keep files and functions at a manageable size.
- Prefer simple, flat control flow over deep nesting.
- Keep the codebase clean by removing dead and legacy-only code.

## File and Function Size

- Keep source files at a reasonable length; split large files into focused modules.
- Keep functions short and focused on one responsibility.
- If a file or function becomes long or hard to navigate, refactor early.
- Refactoring is expected, not optional, when complexity grows.

## Flat Logic First

- Prefer guard clauses and early returns.
- Avoid deep nested `if/else` chains where flattening is possible.
- Extract nested logic into helper functions with clear names.
- Keep async control flow explicit and easy to trace.
- Prefer `async/await` over nested `.then()` chains.

## Clean Code Policy

- Remove unused code, old branches, and stale utilities.
- Do not keep compatibility/fallback code when current logic is confirmed and stable.
- Keep reliability fallbacks that are required for system safety and operations (for example offline startup, retry, rollback, and recovery paths).
- Remove dead feature flags and temporary migration paths after rollout is complete.
- Keep imports and modules free of unused fields and APIs.

## TypeScript Specific Guidelines

- Use TypeScript's type system to catch errors early; avoid `any` unless absolutely necessary.
- Prefer `unknown` over `any` when the type is truly dynamic.
- Use interfaces for object shapes and type aliases for unions/primitives.
- Export only what is needed; keep internal helpers private to their modules.
- Use `const` by default; `let` only when reassignment is required; never `var`.
- Use template literals over string concatenation.
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safe access.

## React/VSCode Extension Specific Guidelines

- Keep components small and focused; extract sub-components when they grow.
- Keep state management explicit; avoid prop drilling by using context or providers when needed.
- Clean up subscriptions and event listeners in disposal/disconnect handlers.
- Use VSCode's disposal pattern (`context.subscriptions.push()`) for resource cleanup.

## Refactoring Triggers

- Repeated logic appears in multiple places.
- Function has multiple unrelated responsibilities.
- Nested flow makes behavior hard to reason about.
- A change requires touching too many unrelated lines.

## Review Checklist

- Is the file still easy to scan?
- Is the function size still reasonable?
- Can nesting be flattened?
- Is there unused or obsolete code that should be deleted?
- Are TypeScript types specific and accurate?
- Are all resources properly disposed?
