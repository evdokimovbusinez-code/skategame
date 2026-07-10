# World Rebuild 03 — Burnout District

## Art direction

The world was rebuilt around the supplied Burnout references: clean stylised blocky 3D,
dense street detail, readable skate lines, late-sunset warmth, wet pavement, punk fashion
and a physical skate-shop interior. The existing acid skate-zine UI remains the anchor.

## New district

- central DIY skatepark with smooth quarter-pipes, bank, five-step plaza, twin handrails,
  hubbas, manual pad, long rails, ledges and playable clutter;
- open Burnout Skate Co. / bodega interior with wall-mounted decks, footwear bench,
  stocked shelving, coolers, VHS display, checkout, clerk, ceiling lighting and fan;
- enterable abandoned building with two entrances, rooms, columns, mezzanine, stairs,
  broken facade, fire escape and graffiti mission wall;
- Ridgeway apartments with lit/dark windows, balconies, fire escape, courtyard and roof
  utilities;
- loading dock, vacant lot, parking, alleys, truck, cars, dumpsters, fences, benches,
  puddles, signs, posters, cables, lamps, steam and distant skyline;
- story, collectible, stealth, graffiti, enemy and draggable-prop anchors relocated into
  the rebuilt layout.

## Characters and motion

- main player changed to the detailed mohawk/patch-vest punk silhouette;
- local skater, street-punk skater and rival variants now use different layered outfits,
  hair, chains, studs, pockets, shoes and boards;
- faces received eye whites, pupils and clearer expression details;
- skate idle now breathes, shifts shoulders and glances;
- shop fan, alley steam and neon animate continuously.

## Rendering

- native-resolution rendering; no nearest-neighbour world upscale;
- 4× procedural texture resolution, mipmaps and anisotropic filtering;
- PBR concrete, brick, asphalt, wood and metal;
- ACES filmic tone mapping, GTAO, soft shadows, selective bloom and real interior lights;
- smooth high-resolution painted sky and retuned dusk palette;
- scanlines removed from the 3D world; the established zine UI is unchanged.

## Verification

- TypeScript compile passes;
- Vite production build passes;
- headless Chromium boot, gameplay, teleports, inventory and screenshots pass with no
  page or console errors.
