# Visual Pass 02 — West Block Zine

## Direction

The game now uses one visual language: a dirty 2000s suburban skate tape mixed with a
photocopied punk zine. The world stays readable and low-poly, while the interface feels
authored for SK8TOWN rather than added as a generic debug overlay.

## Implemented

- colder concrete/asphalt palette with rust, faded teal, and acid-yellow accents;
- denser dusk lighting and a darker, neon-readable night grade;
- low-resolution hand-painted skybox with color bands, dither, stretched clouds, and a
  dirty sunset disc;
- skybox tint connected to the day/night cycle;
- subtle internal-resolution reduction, restrained bloom, scanlines, vignette, and color
  treatment;
- redesigned title screen, pause screen, controls, HUD, objective card, dialogue,
  notifications, combo display, inventory, shop, and finale screen;
- sharper angular shapes, hard offset shadows, torn-paper cards, stencil typography, and
  one consistent color system across every overlay;
- upgraded procedural storefront signs, posters, glass, puddles, lawn, and neon accents.

## Verified

- `npm run build` passes;
- TypeScript compilation passes;
- Vite production bundle is generated successfully.

## Recommended next visual pass

Replace the procedural player/NPC bodies and the most repeated props with a small,
consistent low-poly asset kit. Keep the current lighting and UI as the art-direction
anchor, then add character silhouettes, outfit variants, decals, and landmark props zone
by zone instead of importing a large mixed-style asset dump.
