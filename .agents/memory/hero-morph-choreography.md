---
name: Hero image morph choreography
description: Wayora's hero-to-story handoff depends on a long pinned scroll range and a bridge state.
---

The hero image should stay pinned long enough to finish its scale, position, and radius transformation before the next section enters normal flow. A small bridge caption prevents the long pinned tail from reading as empty space.

**Why:** A shorter hero wrapper or negative-margin story overlap either cuts the morph off early or makes the next section visible at page load.

**How to apply:** Keep the story section in normal document flow; tune the hero's scroll range and bridge copy together when adjusting the choreography.