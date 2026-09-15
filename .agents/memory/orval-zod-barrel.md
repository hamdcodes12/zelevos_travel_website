---
name: Orval Zod barrel exports
description: OpenAPI codegen can create a TypeScript name collision between response validators and generated response interfaces
---

When Orval generates both Zod response validators and TypeScript schema interfaces, keep their exported names distinct before regenerating clients. A response component named `AiChatResponse` can collide with the generated `AiChatResponse` validator when both generated barrels are re-exported.

**Why:** The collision only appears during codegen/typecheck, so a feature can look correct until the next OpenAPI regeneration.

**How to apply:** If a generated response schema and validator share a name, use a distinct OpenAPI component name for the interface payload, then run the workspace codegen and typecheck together.