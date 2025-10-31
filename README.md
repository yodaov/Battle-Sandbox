# Battle Sandbox

A browser-based, drag-and-drop **battle playground** where you create two fighters, paint their 16×16 sprites, edit stats, and **script abilities** in a simple JavaScript template. Export/import your builds and **simulate** a 2D arena fight with basic movement AI (ranged kite, melee chase).

> Why JavaScript?
>
> You asked for “python/html (what you think is best)”. For a repo that runs instantly in any browser **without a server**, JavaScript + HTML is the most reliable choice. It avoids extra dependencies and lets you share a single `index.html`. (A Python mode via Pyodide is documented as an optional extension below.)

## Features
- Two fighters on screen with **movable editor panels**.
- **16×16 pixel sprite editor** (eyedropper, eraser, palette, hex color).
- **Editable stats**: HP, Physical Strength/Resistance, Magical Power/Resistance, Movement Speed, Attack Speed, Can Fly.
- **Ability editor** per fighter: paste a small JS snippet that returns an array of abilities for that fighter.
- **Built-in ability engine** with supported effects: damage, DoT, immunity, time-freeze, knockback, and projectiles.
- **Export/Import** your fighter builds (stats+sprite+ability code) to JSON.
- **Simulation**: melee closes distance; ranged kites. Simple 2D physics with knockback and cooldowns.
- **No build step** — just open `index.html` in a browser.

## Quick Start
1. Download/clone this repo and open `index.html` in a modern browser (desktop recommended).
2. Edit each fighter:
   - **Appearance**: paint the 16×16 sprite.
   - **Stats**: enter numbers or use the steppers.
   - **Abilities**: paste or adapt the template (click *Insert Template*).
3. Click **Validate & Load Abilities** for *each* fighter.
4. Use **Export** / **Import** to save/load your builds.
5. Click **▶ Play** to start the battle. Click **⏸ Pause** to stop.

## Ability Authoring Guide

Abilities are authored in **JavaScript** inside the text area for each fighter and must **return an array**. Use the helper factory `Ability.make(...)` and the utility types described below.

### Minimal example
```js
// Called with (API) available: { Ability, Effects, Shapes, Colors, clamp, rand, vec }
return [
  Ability.make({
    name: "Firebolt",
    type: "magical",        // "physical" | "magical" | "both" | "status"
    cooldown: 2.0,          // seconds; real cooldown = cooldown / attackSpeed
    range: 180,             // px; < ~40 = melee
    appearance: Shapes.circle(4), // simple projectile shape
    effects: [
      Effects.damage({ amount: 12, kind: "magical" }),
      Effects.dot({ dps: 3, duration: 3, kind: "magical" }),
      Effects.knockback({ force: 90 })
    ],
    onCast(self, target, world) {
      world.spawnProjectile({
        speed: 260,
        maxTime: 2.5,
        from: self.pos,
        to: target.pos,
        shape: Shapes.circle(4),
        tint: Colors.fire,
        onHit: (hit) => world.applyEffects(this.effects, self, hit)
      });
    }
  })
];
```

### Supported Fields
- **name**: String label.
- **type**: `"physical" | "magical" | "both" | "status"`.
- **cooldown**: Base seconds between casts. Final cooldown = `cooldown / self.stats.attackSpeed`.
- **range**: Pixels. `< 40` is treated as melee; otherwise ranged.
- **appearance**: Shape descriptor (used mainly by projectiles/FX). Use helpers under `Shapes`.
- **effects**: Array built with `Effects.*` helpers (see below).
- **onCast(self, target, world)**: Function that executes on cast. You can:
  - `world.applyEffects(effects, self, target)` — apply immediate effects.
  - `world.spawnProjectile({...})` — create moving hitbox that applies effects on collision.
  - `world.timeFreeze(target, duration)` — stop target motion.

### Effects API
```js
Effects.damage({ amount, kind: "physical"|"magical"|"both" })          // immediate damage
Effects.dot({ dps, duration, kind })                                   // damage-over-time
Effects.immunity({ kind: "physical"|"magical"|"both", duration })      // grant immunity
Effects.timeFreeze({ duration })                                       // freeze target
Effects.knockback({ force })                                           // push target
```
**Resistances:** damage is mitigated by `amount * (100 / (100 + resist))` using `physicalResistance` or `magicalResistance`. For `"both"`, the damage is split evenly and mitigated by both.

### Shapes & Colors
Use `Shapes.circle(radius)` or `Shapes.square(size)` for simple visuals. Predefined colors are in `Colors`: `fire`, `ice`, `acid`, `arc`, `shadow`, etc.

### Full Template (insert with the **Insert Template** button)
See [`examples/ability_template.js`](examples/ability_template.js).

## Export / Import
- **Export** produces a single JSON with both fighters (stats, sprite, ability code).
- **Import** loads the same JSON format.
- You can also **export each fighter** individually from their panel.

## Simulation Details (why it works)
- **AI policy**: a fighter is *ranged* if it has any ability with `range >= 40`; it **kites** to keep ≈80% of the largest range. Otherwise it **chases** to within 20px.
- **Cooldowns**: each ability tracks its own timer; effective cooldown scales by the fighter’s `attackSpeed`.
- **Damage model**: damage is reduced by resistances using the `100/(100+resist)` curve, which is stable and monotonic.
- **DoT ticking**: applied per second; partial seconds accumulate to ensure precision at variable frame rates.
- **Knockback**: adds impulse to velocity; friction and caps prevent runaway speeds.
- **Time freeze**: sets the target’s timescale to 0 for the duration (movement and regen paused).
- **Projectiles**: straight-line motion with TTL; on hit, invokes `onHit` and applies effects, respecting immunities and freeze.
- **Sprites**: your 16×16 palette is rendered to canvas and scaled for the arena; zero alpha cells are transparent.

## Python Mode (optional extension)
If you want to script abilities in Python:
1. Add **Pyodide** to `index.html` (`<script src="https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js"></script>`).
2. Adapt `AbilityCompiler` in `js/main.js` to route the text to Pyodide and map returned dicts to the same JS schema.
> This is left commented in the code as a stub to keep the base repo lightweight.

## License
MIT — do anything, just keep the copyright and license notices.
