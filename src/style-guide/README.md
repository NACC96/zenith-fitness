# Style Guide Library

This folder is the project style-guide source for reusable UI components.

- `src/style-guide/magnification-dock/`  
  MacOS-inspired `MagnificationDock` component with hover magnification and spring animation.

## Import pattern

```tsx
import { MagnificationDock } from '.';
import { PillNav } from '.';
import { AnimatedList } from '.';
import { GlowingEdgeCard } from '.';
import { NeonTypingButton } from '.';
```

## Existing components

- `MagnificationDock` - in `./magnification-dock`
- `PillNav` - in `./pill-nav`
- `AnimatedList` - in `./animated-list`
- `GlowingEdgeCard` - in `./glowing-edge-card`
- `NeonTypingButton` - in `./neon-typing-button`

### NeonTypingButton

- `NeonTypingButton` is a utility action button with a hover-triggered typing reveal and cursor animation.
- Primary behavior:
  - Shows base text normally, then reveals the target label and cursor on hover.
  - Supports custom glow / reveal / cursor colors via props.
  - Includes optional pulse animation state.
  - Uses a neon purple glow motif by default (`#c026d3`) with 16px blur-glow.
- Import from the style-guide barrel:

```tsx
import { NeonTypingButton } from '.';

<NeonTypingButton
  text="Launch Module"
  glowColor="#c026d3"
  revealTextColor="#ffe7ff"
  cursorColor="#f8c7ff"
/>
```

### NeonTypingButton variants

- `NeonTypingButton` supports `text`-driven reveal animations on hover.
- Cursor animation is built into `typingCursor` element and can be restyled via CSS vars.
- Typical usage for futuristic controls:

```tsx
<NeonTypingButton
  text="System Pulse"
  glowColor="#c026d3"
  revealTextColor="#f8ffc5"
  cursorColor="#ffffff"
  baseTextColor="rgba(235, 235, 235, 0.65)"
/>
```

Add this pattern as an action node where you need high-contrast neon affordances and minimal friction interactions.

## Recommended next step

Export additional components from `src/style-guide/index.ts` to keep shared patterns centralized while keeping each component in its own folder.
