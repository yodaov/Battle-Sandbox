/* Battle Sandbox — main.js (MIT) */

// ---------- Utilities ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a + (b-a)*t;
const dist2 = (a,b) => (a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y);
const distsq = dist2;
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const now = () => performance.now()/1000;
const rand = (a=0,b=1)=>a+Math.random()*(b-a);
const vec = (x=0,y=0)=>({x,y});
const deepClone = (o)=>JSON.parse(JSON.stringify(o));

function download(filename, blobOrText) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readFile(file) {
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}

// ---------- Shapes & Colors helpers ----------
const Shapes = {
  circle: (radius=4)=>({ kind:"circle", radius }),
  square: (size=6)=>({ kind:"square", size }),
};

const Colors = {
  fire: "#ff8a3a",
  ice: "#74d0ff",
  acid: "#92ff3a",
  arc: "#e5f54a",
  shadow: "#9f80ff",
  neutral: "#dce7f3",
};

// ---------- Effects helpers ----------
const Effects = {
  damage: ({ amount=0, kind="physical" }) => ({ kind:"damage", amount, dtype:kind }),
  dot: ({ dps=0, duration=0, kind="magical" }) => ({ kind:"dot", dps, duration, dtype:kind }),
  immunity: ({ kind="both", duration=1.5 }) => ({ kind:"immunity", dtype:kind, duration }),
  timeFreeze: ({ duration=1 }) => ({ kind:"timeFreeze", duration }),
  knockback: ({ force=80 }) => ({ kind:"knockback", force }),
};

// Factory for abilities (adds defaults + validation)
const Ability = {
  make: (spec) => {
    const a = Object.assign({
      name: "Ability",
      type: "status",
      cooldown: 2.0,
      range: 20,
      appearance: Shapes.circle(3),
      effects: [],
      onCast(self, target, world) {
        // default: immediate effects
        world.applyEffects(this.effects, self, target);
      },
    }, spec || {});
    // simple validation
    if (!["physical","magical","both","status"].includes(a.type)) throw new Error("Invalid ability.type");
    if (typeof a.cooldown!=="number" || a.cooldown<=0) throw new Error("cooldown must be > 0");
    if (typeof a.range!=="number" || a.range<0) throw new Error("range must be >= 0");
    return a;
  }
};

// ---------- UI: Draggable Panels ----------
function makeDraggable(panel){
  const handle = panel.querySelector(".panel-handle");
  let drag=false, offx=0, offy=0;
  handle.addEventListener("mousedown",(e)=>{
    drag=true; offx=e.clientX - panel.offsetLeft; offy=e.clientY - panel.offsetTop;
    panel.style.willChange = "transform";
  });
  window.addEventListener("mousemove",(e)=>{
    if(!drag) return;
    panel.style.left = (e.clientX - offx) + "px";
    panel.style.top  = (e.clientY - offy) + "px";
  });
  window.addEventListener("mouseup", ()=>{ drag=false; panel.style.willChange="auto"; });
}

// ---------- UI: Sprite Editor ----------
function SpriteEditor(gridEl, colorEl) {
  const size = 16;
  const pixels = Array.from({length:size*size},()=>null);
  let tool="paint"; // "paint" | "erase" | "eyedrop"
  function setTool(t){ tool=t; }
  function setPixel(ix, hex){
    pixels[ix] = hex;
    const cell = gridEl.children[ix];
    cell.style.background = hex || "";
    cell.dataset.empty = hex? "0" : "1";
  }
  function getColor(ix){ return pixels[ix]; }
  function clear(){ for(let i=0;i<pixels.length;i++) setPixel(i,null); }
  function toData(){ return pixels; }
  function fromData(arr){ for(let i=0;i<Math.min(arr.length,pixels.length);i++) setPixel(i, arr[i]); }

  // build cells
  gridEl.innerHTML = "";
  for(let i=0;i<size*size;i++){
    const cell = document.createElement("div");
    cell.className="cell";
    cell.dataset.empty="1";
    cell.addEventListener("mousedown",(e)=>{
      if(tool==="eyedrop"){
        const c = getColor(i); if(c) colorEl.value=c;
        tool="paint"; // revert to paint after eyedrop
        return;
      }
      if(tool==="erase"){ setPixel(i, null); return; }
      setPixel(i, colorEl.value);
    });
    cell.addEventListener("mouseenter",(e)=>{
      if(e.buttons===1){
        if(tool==="erase"){ setPixel(i, null); return; }
        if(tool==="paint") setPixel(i, colorEl.value);
      }
    });
    gridEl.appendChild(cell);
  }

  return { size, setTool, clear, toData, fromData };
}

// ---------- UI: Stats ----------
function StatsEditor(rootEl, flyEl) {
  const fields = [
    ["HP","hp", 100],
    ["Physical Strength","physicalStrength", 10],
    ["Physical Resistance","physicalResistance", 20],
    ["Magical Power","magicalPower", 10],
    ["Magical Resistance","magicalResistance", 20],
    ["Movement Speed (px/s)","moveSpeed", 120],
    ["Attack Speed (x)","attackSpeed", 1],
  ];
  let data = Object.fromEntries(fields.map(([_,k,d])=>[k,d]));
  function render(){
    rootEl.innerHTML="";
    for(const [label, key, def] of fields){
      const w = document.createElement("label");
      w.innerHTML = `<span>${label}</span><input type="number" step="1" value="${data[key]}" data-key="${key}"/>`;
      const inp = w.querySelector("input");
      inp.addEventListener("change", ()=>{
        let v = parseFloat(inp.value);
        if(!isFinite(v)) v = def;
        data[key] = v;
      });
      rootEl.appendChild(w);
    }
  }
  render();
  flyEl.checked = false;
  return {
    get: () => ({
      hp: +data.hp||100,
      physicalStrength: +data.physicalStrength||0,
      physicalResistance: +data.physicalResistance||0,
      magicalPower: +data.magicalPower||0,
      magicalResistance: +data.magicalResistance||0,
      moveSpeed: +data.moveSpeed||100,
      attackSpeed: +data.attackSpeed||1,
      canFly: !!flyEl.checked,
    }),
    set: (obj)=>{
      for(const k in obj){
        if(k==="canFly"){ flyEl.checked = !!obj[k]; continue; }
        const inp = rootEl.querySelector(`input[data-key="${k}"]`);
        if(inp){ inp.value = obj[k]; }
      }
    }
  };
}

// ---------- Ability Compiler ----------
function compileAbilities(src, label, statusEl){
  // Provide a safe-ish API surface
  const API = { Ability, Effects, Shapes, Colors, clamp, rand, vec };
  let fn;
  try{
    fn = new Function("Ability","Effects","Shapes","Colors","clamp","rand","vec", `"use strict";\n${src}\n//# sourceURL=abilities_${label}.js`);
  }catch(e){
    statusEl.textContent = "Syntax error: " + e.message;
    statusEl.style.color = "#ffb4c0";
    return null;
  }
  let result;
  try{
    result = fn(API.Ability, API.Effects, API.Shapes, API.Colors, API.clamp, API.rand, API.vec);
    if(!Array.isArray(result)) throw new Error("Ability script must return an array");
    // validate abilities
    for(const a of result){ Ability.make(a); } // will throw if invalid
    statusEl.textContent = `Loaded ${result.length} abilities.`;
    statusEl.style.color = "#98ffc1";
    return result.map(a => Ability.make(a));
  }catch(e){
    statusEl.textContent = "Runtime error: " + e.message;
    statusEl.style.color = "#ffb4c0";
    return null;
  }
}

// ---------- Fighter Model ----------
function makeFighter(name, spriteData, stats, abilities){
  return {
    name,
    base: {
      sprite: deepClone(spriteData),
      stats: deepClone(stats),
      abilitiesSrc: "",
    },
    state: {
      hp: stats.hp,
      pos: vec(0,0),
      vel: vec(0,0),
      facing: 1,
      dots: [], // {dps, t, duration, dtype}
      immunities: { physical:0, magical:0, both:0 },
      freeze: 0,
      cd: {}, // name => time left
    },
    abilities: abilities || [],
  };
}

function serializeFighter(f, abilitiesSrc){
  return {
    name: f.name,
    sprite: f.base.sprite,
    stats: f.base.stats,
    abilities: abilitiesSrc ?? f.base.abilitiesSrc,
  };
}

// ---------- Arena / Simulation ----------
const Arena = {
  init(canvas){
    this.cv = canvas;
    this.cx = canvas.getContext("2d");
    this.last = now();
    this.running=false;
    this.fighters=[];
    this.projectiles=[];
    this.fx=[];
    this.bounds = { x:40, y:40, w: canvas.width-80, h: canvas.height-80 };
    requestAnimationFrame(this.loop.bind(this));
  },
  start(){ this.running=true; },
  pause(){ this.running=false; },
  reset(fighters){
    this.fighters = fighters;
    // spawn positions
    const midx = this.cv.width/2;
    const midy = this.cv.height/2;
    if(this.fighters[0]){ this.fighters[0].state.pos = vec(midx-220, midy); this.fighters[0].state.hp = this.fighters[0].base.stats.hp; }
    if(this.fighters[1]){ this.fighters[1].state.pos = vec(midx+220, midy); this.fighters[1].state.hp = this.fighters[1].base.stats.hp; }
    this.projectiles.length=0;
  },
  spawnProjectile(p){
    // p: {speed,maxTime,from,to,shape,tint,onHit}
    const dir = { x: p.to.x - p.from.x, y: p.to.y - p.from.y };
    const L = Math.hypot(dir.x, dir.y) || 1;
    dir.x/=L; dir.y/=L;
    this.projectiles.push({
      pos: {x:p.from.x, y:p.from.y},
      vel: {x:dir.x*(p.speed||220), y:dir.y*(p.speed||220)},
      ttl: p.maxTime || 2,
      shape: p.shape || Shapes.circle(3),
      tint: p.tint || Colors.neutral,
      onHit: p.onHit || (()=>{}),
      alive: true,
    });
  },
  timeFreeze(target, duration){ target.state.freeze = Math.max(target.state.freeze, duration||1); },
  applyEffects(effects, caster, target){
    for(const e of effects){
      if(e.kind==="damage"){
        if(this.isImmune(target, e.dtype)) continue;
        let amt = e.amount||0;
        if(e.dtype==="physical") amt *= 100/(100+target.base.stats.physicalResistance);
        else if(e.dtype==="magical") amt *= 100/(100+target.base.stats.magicalResistance);
        else if(e.dtype==="both"){
          let half = (amt/2) * 100/(100+target.base.stats.physicalResistance);
          half += (amt/2) * 100/(100+target.base.stats.magicalResistance);
          amt = half;
        }
        target.state.hp -= amt;
      }else if(e.kind==="dot"){
        if(this.isImmune(target, e.dtype)) continue;
        target.state.dots.push({ dps:e.dps||0, duration:e.duration||0, t:0, dtype:e.dtype });
      }else if(e.kind==="immunity"){
        const k = e.dtype||"both";
        target.state.immunities[k] = Math.max(target.state.immunities[k]||0, e.duration||0);
      }else if(e.kind==="timeFreeze"){
        this.timeFreeze(target, e.duration||1);
      }else if(e.kind==="knockback"){
        const dir = { x: Math.sign(target.state.pos.x - caster.state.pos.x), y: Math.sign(target.state.pos.y - caster.state.pos.y) };
        target.state.vel.x += dir.x * (e.force||80) / 2;
        target.state.vel.y += dir.y * (e.force||80) / 2;
      }
    }
  },
  isImmune(target, dtype){
    if(dtype==="both") return (target.state.immunities.both>0)||(target.state.immunities.physical>0 && target.state.immunities.magical>0);
    return (target.state.immunities[dtype]>0)||(target.state.immunities.both>0);
  },
  tick(dt){
    // cooldown & dot & immunity decay
    for(const f of this.fighters){
      // dots
      for(let i=f.state.dots.length-1;i>=0;i--){
        const d = f.state.dots[i];
        if(d.duration<=0){ f.state.dots.splice(i,1); continue; }
        d.t = (d.t || 0) + dt;
        while(d.t >= 1){
          d.t -= 1;
          if(!this.isImmune(f, d.dtype)) f.state.hp -= d.dps;
          d.duration -= 1;
        }
      }
      // immunities decay
      for(const k of ["physical","magical","both"]){
        if(f.state.immunities[k]>0) f.state.immunities[k] -= dt;
      }
      // cooldowns
      for(const a of f.abilities){
        if(!(a.name in f.state.cd)) f.state.cd[a.name]=0;
        const cd = Math.max(0, f.state.cd[a.name]-dt);
        f.state.cd[a.name]=cd;
      }
    }

    // projectiles
    for(const p of this.projectiles){
      if(!p.alive) continue;
      p.ttl -= dt;
      if(p.ttl<=0){ p.alive=false; continue; }
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      // collide with fighters
      for(const f of this.fighters){
        const r = 18;
        if(dist(p.pos, f.state.pos) < r){
          p.alive=false;
          p.onHit && p.onHit(f);
        }
      }
    }
    // cleanup
    this.projectiles = this.projectiles.filter(p=>p.alive);

    // AI & movement
    const [A,B] = this.fighters;
    if(A && B){
      const pairs = [[A,B],[B,A]];
      for(const [me, op] of pairs){
        if(me.state.freeze>0){ me.state.freeze-=dt; continue; }
        // choose desire distance
        const maxRange = me.abilities.reduce((m,a)=>Math.max(m, a.range||0), 0);
        const ranged = maxRange >= 40;
        const desired = ranged ? maxRange*0.8 : 20;
        const d = dist(me.state.pos, op.state.pos);
        const dir = { x: op.state.pos.x - me.state.pos.x, y: op.state.pos.y - me.state.pos.y };
        const L = Math.hypot(dir.x, dir.y) || 1;
        dir.x/=L; dir.y/=L;
        // Move
        const speed = me.base.stats.moveSpeed;
        if(ranged && d < desired){
          // kite away
          me.state.pos.x -= dir.x * speed * dt;
          me.state.pos.y -= dir.y * speed * dt;
        }else if(!ranged && d > desired){
          // chase
          me.state.pos.x += dir.x * speed * dt;
          me.state.pos.y += dir.y * speed * dt;
        }
        // Knockback velocity & friction
        me.state.pos.x += me.state.vel.x * dt;
        me.state.pos.y += me.state.vel.y * dt;
        me.state.vel.x *= Math.pow(0.2, dt); // decay
        me.state.vel.y *= Math.pow(0.2, dt);
        // Bounds
        const b=this.bounds;
        me.state.pos.x = clamp(me.state.pos.x, b.x, b.x+b.w);
        me.state.pos.y = clamp(me.state.pos.y, b.y, b.y+b.h);
        me.state.facing = me.state.pos.x < op.state.pos.x ? 1 : -1;

        // Cast
        for(const a of me.abilities){
          if(me.state.cd[a.name]>0) continue;
          const inRange = d <= Math.max(20, a.range||0);
          if(inRange){
            me.state.cd[a.name] = Math.max(0.1, (a.cooldown||1) / Math.max(0.1, me.base.stats.attackSpeed));
            a.onCast.call(a, me, op, this);
            break; // one ability at a time
          }
        }
      }
    }

    // Check deaths
    for(const f of this.fighters){
      if(f.state.hp <= 0) f.state.hp = 0;
    }
  },
  draw(){
    const cx = this.cx;
    const w=this.cv.width, h=this.cv.height;
    // bg
    cx.clearRect(0,0,w,h);
    // arena bounds
    cx.strokeStyle="#1b2a3f";
    cx.lineWidth=2;
    cx.setLineDash([6,6]);
    cx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
    cx.setLineDash([]);

    // projectiles
    for(const p of this.projectiles){
      cx.save();
      cx.globalAlpha = 0.95;
      cx.fillStyle = p.tint || Colors.neutral;
      if(p.shape?.kind==="circle"){
        cx.beginPath();
        cx.arc(p.pos.x, p.pos.y, p.shape.radius||3, 0, Math.PI*2);
        cx.fill();
      }else{
        const s = p.shape?.size||6;
        cx.fillRect(p.pos.x - s/2, p.pos.y - s/2, s, s);
      }
      cx.restore();
    }

    // fighters
    for(const f of this.fighters){
      const s = 32;
      drawSpriteAt(cx, f.base.sprite, f.state.pos.x - s/2, f.state.pos.y - s/2, s, s);
      // hp bar
      cx.fillStyle="#0d1420";
      cx.fillRect(f.state.pos.x - 24, f.state.pos.y - 30, 48, 6);
      let hpPct = clamp(f.state.hp / f.base.stats.hp, 0, 1);
      cx.fillStyle = hpPct>0.5 ? "#70ffa3" : hpPct>0.2 ? "#ffd15e" : "#ff7e7e";
      cx.fillRect(f.state.pos.x - 24, f.state.pos.y - 30, 48*hpPct, 6);
    }
  },
  loop(){
    const t = now();
    const dt = Math.min(0.033, t - this.last);
    this.last = t;
    if(this.running) this.tick(dt);
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }
};

function drawSpriteAt(cx, data, x,y, w,h){
  const sx=16, sy=16;
  const cellw = w/sx, cellh = h/sy;
  for(let j=0;j<sy;j++){
    for(let i=0;i<sx;i++){
      const c = data[j*sx+i];
      if(!c) continue;
      cx.fillStyle = c;
      cx.fillRect(x + i*cellw, y + j*cellh, Math.ceil(cellw), Math.ceil(cellh));
    }
  }
}

// ---------- Bootstrapping Editors ----------
const arena = document.getElementById("arena");
Arena.init(arena);

// Panels draggable
makeDraggable(document.getElementById("fighterA"));
makeDraggable(document.getElementById("fighterB"));

// Sprite editors
const spriteA = SpriteEditor(document.getElementById("gridA"), document.getElementById("colorA"));
const spriteB = SpriteEditor(document.getElementById("gridB"), document.getElementById("colorB"));
document.querySelector("[data-tool='eyedropA']").onclick = ()=> spriteA.setTool("eyedrop");
document.querySelector("[data-tool='eraseA']").onclick = ()=> spriteA.setTool("erase");
document.querySelector("[data-tool='eyedropB']").onclick = ()=> spriteB.setTool("eyedrop");
document.querySelector("[data-tool='eraseB']").onclick = ()=> spriteB.setTool("erase");
document.getElementById("clearA").onclick = ()=> spriteA.clear();
document.getElementById("clearB").onclick = ()=> spriteB.clear();

// Stats editors
const statsA = StatsEditor(document.getElementById("statsA"), document.getElementById("flyA"));
const statsB = StatsEditor(document.getElementById("statsB"), document.getElementById("flyB"));

// Ability textareas and status
const abilitiesA = document.getElementById("abilitiesA");
const abilitiesB = document.getElementById("abilitiesB");
const statusA = document.getElementById("statusA");
const statusB = document.getElementById("statusB");

// Templates
const template = `// Your code must RETURN an array of abilities. API: Ability, Effects, Shapes, Colors, clamp, rand, vec
// Example with one melee and one ranged ability
return [
  Ability.make({
    name: "Slash",
    type: "physical",
    cooldown: 1.2,
    range: 20,
    appearance: Shapes.square(6),
    effects: [ Effects.damage({ amount: 14, kind: "physical" }) ],
    onCast(self, target, world){
      world.applyEffects(this.effects, self, target);
      world.applyEffects([Effects.knockback({force:110})], self, target);
    }
  }),
  Ability.make({
    name: "Firebolt",
    type: "magical",
    cooldown: 2.0,
    range: 200,
    appearance: Shapes.circle(4),
    effects: [ Effects.damage({ amount: 10, kind: "magical" }), Effects.dot({ dps:2, duration:3, kind:"magical"}) ],
    onCast(self, target, world){
      world.spawnProjectile({
        speed: 260,
        maxTime: 2.5,
        from: self.pos, to: target.pos,
        shape: Shapes.circle(4), tint: Colors.fire,
        onHit: (hit) => world.applyEffects(this.effects, self, hit),
      });
    }
  }),
];`;

document.getElementById("tplA").onclick = ()=>{ abilitiesA.value = template; };
document.getElementById("tplB").onclick = ()=>{ abilitiesB.value = template; };

// Validate buttons
let compiledA = [];
let compiledB = [];
document.getElementById("validateA").onclick = ()=>{
  const c = compileAbilities(abilitiesA.value, "A", statusA);
  if(c) compiledA = c;
};
document.getElementById("validateB").onclick = ()=>{
  const c = compileAbilities(abilitiesB.value, "B", statusB);
  if(c) compiledB = c;
};

// Export / Import per fighter
document.getElementById("exportA").onclick = ()=>{
  const blob = JSON.stringify({
    name:"Fighter A",
    sprite: spriteA.toData(),
    stats: statsA.get(),
    abilities: abilitiesA.value
  }, null, 2);
  download("fighterA.json", blob);
};
document.getElementById("exportB").onclick = ()=>{
  const blob = JSON.stringify({
    name:"Fighter B",
    sprite: spriteB.toData(),
    stats: statsB.get(),
    abilities: abilitiesB.value
  }, null, 2);
  download("fighterB.json", blob);
};

document.getElementById("importABtn").onclick = ()=> document.getElementById("importA").click();
document.getElementById("importBBtn").onclick = ()=> document.getElementById("importB").click();

document.getElementById("importA").addEventListener("change", async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await readFile(file);
  const obj = JSON.parse(text);
  spriteA.fromData(obj.sprite||[]);
  statsA.set(obj.stats||{});
  abilitiesA.value = obj.abilities||"";
  statusA.textContent = "Loaded fighter A from file.";
});
document.getElementById("importB").addEventListener("change", async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await readFile(file);
  const obj = JSON.parse(text);
  spriteB.fromData(obj.sprite||[]);
  statsB.set(obj.stats||{});
  abilitiesB.value = obj.abilities||"";
  statusB.textContent = "Loaded fighter B from file.";
});

// Export / Import both
document.getElementById("exportAll").onclick = ()=>{
  const blob = JSON.stringify({
    fighterA: { sprite: spriteA.toData(), stats: statsA.get(), abilities: abilitiesA.value },
    fighterB: { sprite: spriteB.toData(), stats: statsB.get(), abilities: abilitiesB.value },
    version: 1
  }, null, 2);
  download("battle-sandbox-build.json", blob);
};
document.getElementById("importAllBtn").onclick = ()=> document.getElementById("importAll").click();
document.getElementById("importAll").addEventListener("change", async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await readFile(file);
  const obj = JSON.parse(text);
  if(obj.fighterA){
    spriteA.fromData(obj.fighterA.sprite||[]);
    statsA.set(obj.fighterA.stats||{});
    abilitiesA.value = obj.fighterA.abilities||"";
  }
  if(obj.fighterB){
    spriteB.fromData(obj.fighterB.sprite||[]);
    statsB.set(obj.fighterB.stats||{});
    abilitiesB.value = obj.fighterB.abilities||"";
  }
  statusA.textContent = statusB.textContent = "Imported build.";
});

// Play / Pause / Reset
document.getElementById("playBtn").onclick = ()=>{
  // compile defaults if not already
  if(!compiledA.length){ const c = compileAbilities(abilitiesA.value||template, "A", statusA); if(c) compiledA=c; }
  if(!compiledB.length){ const c = compileAbilities(abilitiesB.value||template, "B", statusB); if(c) compiledB=c; }
  const fA = makeFighter("A", spriteA.toData(), statsA.get(), compiledA);
  fA.base.abilitiesSrc = abilitiesA.value;
  const fB = makeFighter("B", spriteB.toData(), statsB.get(), compiledB);
  fB.base.abilitiesSrc = abilitiesB.value;
  Arena.reset([fA, fB]);
  Arena.start();
  document.getElementById("playBtn").disabled = true;
  document.getElementById("pauseBtn").disabled = false;
};
document.getElementById("pauseBtn").onclick = ()=>{
  Arena.pause();
  document.getElementById("playBtn").disabled = false;
  document.getElementById("pauseBtn").disabled = true;
};
document.getElementById("resetBtn").onclick = ()=>{
  Arena.pause();
  Arena.reset(Arena.fighters);
  document.getElementById("playBtn").disabled = false;
  document.getElementById("pauseBtn").disabled = true;
};

// ---------- Example Abilities prefill ----------
abilitiesA.value = `return [
  Ability.make({
    name: "Dash Slash",
    type: "physical",
    cooldown: 1.0,
    range: 24,
    appearance: Shapes.square(6),
    effects: [Effects.damage({amount: 15, kind:"physical"}), Effects.knockback({force:120})],
    onCast(self, target, world){
      // mini dash toward target
      const dir = vec(Math.sign(target.pos.x-self.pos.x), Math.sign(target.pos.y-self.pos.y));
      self.pos.x += dir.x * 16; self.pos.y += dir.y * 8;
      world.applyEffects(this.effects, self, target);
    }
  })
];`;

abilitiesB.value = `return [
  Ability.make({
    name: "Frost Bolt",
    type: "magical",
    cooldown: 1.6,
    range: 200,
    appearance: Shapes.circle(4),
    effects: [Effects.damage({amount: 11, kind:"magical"}), Effects.dot({dps:2, duration:2, kind:"magical"})],
    onCast(self, target, world){
      world.spawnProjectile({
        speed: 240, maxTime: 2.5,
        from: self.pos, to: target.pos,
        shape: Shapes.circle(4), tint: Colors.ice,
        onHit: (hit)=> world.applyEffects(this.effects, self, hit)
      });
    }
  }),
  Ability.make({
    name: "Time Stop (mini)",
    type: "status",
    cooldown: 6.0,
    range: 160,
    appearance: Shapes.square(6),
    effects: [Effects.timeFreeze({duration: 0.8})],
    onCast(self, target, world){
      world.timeFreeze(target, 0.8);
    }
  })
];`;

// ---------- End main.js ----------
