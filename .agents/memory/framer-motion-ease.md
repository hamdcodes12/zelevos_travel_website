---
name: Framer Motion v12 Bezier Ease
description: ease arrays in Framer Motion v12 require explicit tuple type casting to avoid TS errors sitewide
---

# Framer Motion v12 Bezier Ease Typing

## The Rule
Never write `ease: [0.22, 1, 0.36, 1]` as a plain array literal in Framer Motion variant objects — TS infers `number[]` which is not assignable to `BezierDefinition = [number, number, number, number]`.

## Why
Framer Motion v12 tightened the `Easing` type. The `ease` property in `Transition` expects `Easing | Easing[]`, where `Easing` is `"linear" | "easeIn" | ... | [number,number,number,number]`. A plain `number[]` array literal doesn't satisfy this.

## How to Apply
Two correct patterns:
1. Cast inline: `ease: [0.22, 1, 0.36, 1] as [number, number, number, number]`
2. Use a typed constant: `const EASE = [0.22, 1, 0.36, 1] as const;`

The pre-existing codebase has ~30+ files with this error — they are pre-existing and don't cause runtime issues (Vite doesn't type-check). New code should use the cast pattern.
