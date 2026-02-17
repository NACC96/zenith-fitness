# NeonTypingButton

A futuristic action button that swaps base text with a neon-typed reveal string and a blinking cursor on hover.

## Usage

```tsx
<NeonTypingButton
  text="Launch Module"
  glowColor="#c026d3"
  revealTextColor="#ffe7ff"
  cursorColor="#ffffff"
  baseTextColor="rgba(235, 235, 235, 0.65)"
/>
```

## Props

- `text` (**required**) — text used for hover reveal and cursor typing.
- `baseTextColor` — color for static label state.
- `revealTextColor` — color for the revealed label and typing treatment.
- `glowColor` — base glow + border accent.
- `cursorColor` — cursor color.
- `cursorSymbol` — custom cursor glyph.
- `pulse` — toggles ambient glow animation (`false` disables pulsing).
- `revealLengthPadding` — extra character spacing used to calculate the reveal width.

The component is optimized for hover-driven command interactions in dark glass contexts:
- keep text short (3-18 characters),
- use uppercase words for stronger contrast,
- and align text timing with neighboring command elements.
