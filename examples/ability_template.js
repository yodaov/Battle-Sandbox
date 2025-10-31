// Ability Template — paste into a fighter's editor and adjust. Must RETURN an array.
// API: Ability, Effects, Shapes, Colors, clamp, rand, vec
return [
  Ability.make({
    name: "Your Ability Name",
    type: "physical",   // "physical" | "magical" | "both" | "status"
    cooldown: 2.0,      // seconds; final CD scales with attackSpeed
    range: 20,          // px; < 40 considered melee
    appearance: Shapes.circle(4),
    effects: [
      // Pick any:
      // Effects.damage({ amount: 12, kind: "physical"|"magical"|"both" }),
      // Effects.dot({ dps: 3, duration: 3, kind: "magical" }),
      // Effects.immunity({ kind: "magical", duration: 1.5 }),
      // Effects.timeFreeze({ duration: 1.0 }),
      // Effects.knockback({ force: 120 }),
    ],
    onCast(self, target, world){
      // Either apply immediate effects:
      // world.applyEffects(this.effects, self, target);

      // Or spawn a projectile that applies on hit:
      // world.spawnProjectile({
      //   speed: 260,
      //   maxTime: 2.5,
      //   from: self.pos,
      //   to: target.pos,
      //   shape: Shapes.circle(4),
      //   tint: Colors.fire,
      //   onHit: (hit) => world.applyEffects(this.effects, self, hit)
      // });
    }
  })
];
