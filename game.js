// game.js — WebGL renderer + game loop

// ── WebGL helpers ─────────────────────────────────────────────────────────────
function compileShader(gl, src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(s));
  return s;
}
function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, vs, gl.VERTEX_SHADER));
  gl.attachShader(p, compileShader(gl, fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(p);
  return p;
}
function createBuffer(gl, data, usage = WebGLRenderingContext.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
  return b;
}
function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    let s=0; for(let k=0;k<4;k++) s+=a[i*4+k]*b[k*4+j];
    out[i*4+j]=s;
  }
  return out;
}
function mat4Perspective(fov, asp, near, far) {
  const f = 1/Math.tan(fov/2);
  const nf = 1/(near-far);
  return new Float32Array([
    f/asp,0,0,0, 0,f,0,0,
    0,0,(far+near)*nf,-1,
    0,0,2*far*near*nf,0
  ]);
}
function mat4View(px,py,pz,yaw,pitch) {
  const cy=Math.cos(yaw),sy=Math.sin(yaw);
  const cp=Math.cos(pitch),sp=Math.sin(pitch);
  const dx=sy*cp, dy=sp, dz=-cy*cp;
  // right vector
  const rx=cy, ry=0, rz=sy;
  // up = right × dir
  const ux=ry*dz-rz*dy, uy=rz*dx-rx*dz, uz=rx*dy-ry*dx;
  return new Float32Array([
    rx,ux,-dx,0,
    ry,uy,-dy,0,
    rz,uz,-dz,0,
    -(rx*px+ry*py+rz*pz),
    -(ux*px+uy*py+uz*pz),
    -(-dx*px-dy*py-dz*pz),1
  ]);
}
function mat4Scale(x,y,z) {
  return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
}
function mat4Translate(x,y,z) {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
}
function mat4RotY(a) {
  const c=Math.cos(a),s=Math.sin(a);
  return new Float32Array([c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]);
}

// ── Shaders ───────────────────────────────────────────────────────────────────
const VS_MAIN = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform vec3 uSunDir;
uniform vec3 uAmbient;
uniform vec3 uColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vColor;
varying float vFog;
varying vec2 vUV;
void main(){
  vec4 worldPos = uModel * vec4(aPos,1.0);
  gl_Position = uMVP * vec4(aPos,1.0);
  vec3 worldNorm = normalize(mat3(uModel)*aNorm);
  float diff = max(dot(worldNorm, normalize(uSunDir)),0.0);
  vColor = uColor*(uAmbient + diff*0.6);
  float dist = length(worldPos.xyz);
  vFog = clamp((dist-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  vUV = aUV;
}`;

const FS_MAIN = `
precision mediump float;
varying vec3 vColor;
varying float vFog;
varying vec2 vUV;
uniform vec4 uFogColor;
uniform sampler2D uTex;
uniform float uUseTexture;
void main(){
  vec4 base = mix(vec4(vColor,1.0), texture2D(uTex,vUV), uUseTexture);
  gl_FragColor = mix(base, uFogColor, vFog);
}`;

// Billboard (for grass blades / item sprites)
const VS_BILL = `
attribute vec3 aPos;
attribute vec2 aUV;
uniform mat4 uVP;
uniform vec3 uCenter;
uniform vec3 uCamRight;
uniform vec2 uSize;
varying vec2 vUV;
varying float vFog;
uniform float uFogNear;
uniform float uFogFar;
void main(){
  vec3 pos = uCenter + uCamRight*aPos.x*uSize.x + vec3(0,1,0)*aPos.y*uSize.y;
  gl_Position = uVP * vec4(pos,1.0);
  float dist = length(pos);
  vFog = clamp((dist-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  vUV = aUV;
}`;
const FS_BILL = `
precision mediump float;
varying vec2 vUV;
varying float vFog;
uniform vec4 uColor;
uniform vec4 uFogColor;
void main(){
  if(vUV.x < 0.15 || vUV.x > 0.85) discard;
  float a = 1.0 - abs(vUV.x - 0.5)*2.5;
  a *= 1.0 - vUV.y * 0.3;
  vec4 c = vec4(uColor.rgb, uColor.a * a);
  if(c.a < 0.1) discard;
  gl_FragColor = mix(c, uFogColor, vFog);
}`;

// ── Geometry helpers ──────────────────────────────────────────────────────────
function buildPlane(w, h, segsX, segsZ) {
  const verts=[], norms=[], uvs=[], idx=[];
  for(let z=0;z<=segsZ;z++) for(let x=0;x<=segsX;x++) {
    verts.push((x/segsX-.5)*w, 0, (z/segsZ-.5)*h);
    norms.push(0,1,0);
    uvs.push(x/segsX*8, z/segsZ*8);
  }
  for(let z=0;z<segsZ;z++) for(let x=0;x<segsX;x++) {
    const tl=z*(segsX+1)+x, tr=tl+1, bl=tl+segsX+1, br=bl+1;
    idx.push(tl,bl,tr, tr,bl,br);
  }
  return { verts, norms, uvs, idx };
}
function buildCube(w,h,d) {
  const hw=w/2,hh=h/2,hd=d/2;
  const verts=[], norms=[], uvs=[];
  function face(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,nx,ny,nz) {
    verts.push(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz);
    for(let i=0;i<4;i++) norms.push(nx,ny,nz);
    uvs.push(0,0,1,0,1,1,0,1);
  }
  face(-hw,-hh, hd, hw,-hh, hd, hw, hh, hd,-hw, hh, hd, 0,0,1);
  face( hw,-hh,-hd,-hw,-hh,-hd,-hw, hh,-hd, hw, hh,-hd, 0,0,-1);
  face(-hw,-hh,-hd,-hw,-hh, hd,-hw, hh, hd,-hw, hh,-hd,-1,0,0);
  face( hw,-hh, hd, hw,-hh,-hd, hw, hh,-hd, hw, hh, hd, 1,0,0);
  face(-hw, hh, hd, hw, hh, hd, hw, hh,-hd,-hw, hh,-hd, 0,1,0);
  face(-hw,-hh,-hd, hw,-hh,-hd, hw,-hh, hd,-hw,-hh, hd, 0,-1,0);
  const idx=[];
  for(let f=0;f<6;f++) {
    const b=f*4;
    idx.push(b,b+1,b+2, b,b+2,b+3);
  }
  return { verts, norms, uvs, idx };
}

// ── Audio (Web Audio API ambient drone) ──────────────────────────────────────
class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.nodes = [];
  }
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._makeDrone(60,  0.06);
      this._makeDrone(90,  0.04);
      this._makeDrone(120, 0.03);
      this._makeWindNoise(0.025);
    } catch(e) { console.log('Audio not available'); }
  }
  _makeDrone(freq, gain) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    // Slow frequency drift
    osc.frequency.linearRampToValueAtTime(freq*1.003, this.ctx.currentTime+8);
    osc.frequency.linearRampToValueAtTime(freq,       this.ctx.currentTime+16);
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime+4);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    this.nodes.push(osc, g);
  }
  _makeWindNoise(gain) {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate*4, this.ctx.sampleRate);
    const ch  = buf.getChannelData(0);
    for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1);
    const src  = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type  = 'lowpass';
    filt.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime+5);
    src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
    src.start();
    this.nodes.push(src, filt, g);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

// ── Main Game class ───────────────────────────────────────────────────────────
class Game {
  constructor() {
    this.canvas  = document.getElementById('game-canvas');
    this.gl      = this.canvas.getContext('webgl', { antialias: true });
    this.player  = null;
    this.world   = new World();
    this.audio   = new AmbientAudio();
    this.running = false;
    this.frameId = null;
    this.time    = 0;
    this._grassInstances = [];
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async init(user, saveData) {
    window.currentUser = user;
    const gl = this.gl;

    // Restore save
    if (saveData) {
      this.world.fromSave(saveData.world);
    }

    // Build GL programs
    this.prog = createProgram(gl, VS_MAIN, FS_MAIN);
    this.progBill = createProgram(gl, VS_BILL, FS_BILL);

    // Build geometry
    this._buildGround();
    this._buildGrass();
    this._buildEntities();

    // Setup GL state
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Init player
    this.player = new Player(this.canvas);
    if (saveData) this.player.fromSave(saveData.player);

    // HUD
    this._refreshHUD();

    // Audio
    this.audio.init();

    // Resize
    this._onResize();
    window.addEventListener('resize', () => this._onResize());

    // Show mobile controls if touch
    if ('ontouchstart' in window) {
      document.getElementById('joystick-container').classList.remove('hidden');
      document.getElementById('btn-interact').classList.remove('hidden');
      document.getElementById('btn-jump').classList.remove('hidden');
    }

    this.running = true;
    this._loop();
  }

  // ── Build ground plane ─────────────────────────────────────────────────────
  _buildGround() {
    const gl  = this.gl;
    const B   = 100;
    const geo = buildPlane(B*2, B*2, 40, 40);

    // Slightly deform Y for a subtle uneven ground feel
    for (let i=0; i<geo.verts.length; i+=3) {
      const x = geo.verts[i], z = geo.verts[i+2];
      geo.verts[i+1] = (Math.sin(x*0.18)*Math.cos(z*0.14)) * 0.12;
    }

    this.groundVB  = createBuffer(gl, geo.verts);
    this.groundNB  = createBuffer(gl, geo.norms);
    this.groundUVB = createBuffer(gl, geo.uvs);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);
    this.groundIB    = ib;
    this.groundCount = geo.idx.length;
  }

  // ── Build grass blades (billboard instances) ───────────────────────────────
  _buildGrass() {
    const gl = this.gl;
    // Quad for billboard
    const verts = [-0.5,0,0, 0.5,0,0, 0.5,1,0, -0.5,1,0];
    const uvs   = [0,1, 1,1, 1,0, 0,0];
    const idx   = [0,1,2, 0,2,3];
    this.grassQuadVB  = createBuffer(gl, verts);
    this.grassQuadUVB = createBuffer(gl, uvs);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.grassIB = ib;

    // Scatter instances
    this._grassInstances = [];
    for (let i=0; i<1800; i++) {
      const angle = Math.random()*Math.PI*2;
      const dist  = Math.random()*80 + 4;
      this._grassInstances.push({
        x: Math.cos(angle)*dist,
        z: Math.sin(angle)*dist,
        scale: 0.55 + Math.random()*0.6,
        rot: Math.random()*Math.PI*2
      });
    }
  }

  // ── Build entity geometry (key, door, pillar) ──────────────────────────────
  _buildEntities() {
    const gl = this.gl;
    // Key — small cube
    const key = buildCube(0.25, 0.5, 0.1);
    this.keyVB = createBuffer(gl, key.verts);
    this.keyNB = createBuffer(gl, key.norms);
    const kib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, kib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(key.idx), gl.STATIC_DRAW);
    this.keyIB = kib;
    this.keyIdxCount = key.idx.length;

    // Door — tall cube
    const door = buildCube(2.2, 4, 0.3);
    this.doorVB = createBuffer(gl, door.verts);
    this.doorNB = createBuffer(gl, door.norms);
    const dib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(door.idx), gl.STATIC_DRAW);
    this.doorIB = dib;
    this.doorIdxCount = door.idx.length;

    // Frame pillar
    const pillar = buildCube(0.25, 4.5, 0.25);
    this.pillarVB = createBuffer(gl, pillar.verts);
    this.pillarNB = createBuffer(gl, pillar.norms);
    const pib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(pillar.idx), gl.STATIC_DRAW);
    this.pillarIB = pib;
    this.pillarIdxCount = pillar.idx.length;
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  _onResize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = window.innerWidth  * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  _loop() {
    if (!this.running) return;
    this.time += 0.016;
    this.player.update(this.world);
    this._checkInteractions();
    this._render();
    this.frameId = requestAnimationFrame(() => this._loop());
  }

  // ── Interaction check ──────────────────────────────────────────────────────
  _checkInteractions() {
    const p   = this.player;
    const lvl = this.world.currentLevel;

    let nearSomething = false;

    // Keys
    lvl.items.forEach((item, i) => {
      if (this.world.isItemCollected(this.world.levelIndex, i)) return;
      const dx = item.x - p.x, dz = item.z - p.z;
      if (Math.sqrt(dx*dx+dz*dz) < 2.2) {
        nearSomething = true;
        showInteractionPrompt('Presiona [E] para recoger la llave');
      }
    });

    // Door
    if (!nearSomething) {
      lvl.doors.forEach(door => {
        const dx = door.x - p.x, dz = door.z - p.z;
        if (Math.sqrt(dx*dx+dz*dz) < 3.5) {
          nearSomething = true;
          const can = this.world.canOpenDoor();
          showInteractionPrompt(can
            ? 'Presiona [E] para cruzar la puerta'
            : `Necesitas ${this.world.itemsLeft()} llaves más`);
        }
      });
    }

    if (!nearSomething) hideInteractionPrompt();
  }

  tryInteract() {
    const p   = this.player;
    const lvl = this.world.currentLevel;

    // Collect keys
    lvl.items.forEach((item, i) => {
      if (this.world.isItemCollected(this.world.levelIndex, i)) return;
      const dx = item.x - p.x, dz = item.z - p.z;
      if (Math.sqrt(dx*dx+dz*dz) < 2.2) {
        this.world.collectItem(this.world.levelIndex, i);
        p.itemsCollected++;
        showToast('🔑 ¡Llave encontrada!');
        this._refreshHUD();
        this.audio.resume();
      }
    });

    // Enter door
    if (this.world.canOpenDoor()) {
      lvl.doors.forEach(door => {
        const dx = door.x - p.x, dz = door.z - p.z;
        if (Math.sqrt(dx*dx+dz*dz) < 3.5) {
          const nextLvl = door.targetLevel;
          const nextName = LEVELS[((nextLvl%LEVELS.length)+LEVELS.length)%LEVELS.length].name;
          showLevelTransition(`Entrando: ${nextName}`, () => {
            this.world.loadLevel(nextLvl);
            p.x = 0; p.z = 5; p.yaw = 0;
            this._refreshHUD();
          });
        }
      });
    }
  }

  _refreshHUD() {
    const lvl = this.world.currentLevel;
    const col = this.world.itemsCollectedInLevel();
    const tot = lvl.items.length;
    updateHUD(
      window.currentUser || 'Jugador',
      `Nivel ${this.world.levelIndex+1} — ${lvl.name}`,
      col, tot
    );
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  _render() {
    const gl  = this.gl;
    const lvl = this.world.currentLevel;
    const p   = this.player;

    // Sky clear
    const sk = lvl.skyColor;
    gl.clearColor(sk[0], sk[1], sk[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const asp = this.canvas.width / this.canvas.height;
    const proj = mat4Perspective(Math.PI/2.8, asp, 0.08, 200);
    const view = mat4View(p.x, p.y, p.z, p.yaw, p.pitch);
    const vp   = mat4Multiply(proj, view);

    // Camera right vector (for billboards)
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const camRight = [cy, 0, sy];

    // Sun / fog uniforms
    const sunDir  = lvl.sunDir;
    const amb     = lvl.ambientCol;
    const fogCol  = lvl.fogColor;
    const fogNear = lvl.fogNear;
    const fogFar  = lvl.fogFar;

    // ── Draw ground ──────────────────────────────────────────────────────────
    const prog = this.prog;
    gl.useProgram(prog);
    const model = mat4Translate(0,0,0);
    const mvp   = mat4Multiply(vp, model);
    this._setMainUniforms(prog, mvp, model, sunDir, amb, lvl.grassColor, fogCol, fogNear, fogFar);
    this._drawMesh(prog,
      this.groundVB, this.groundNB, this.groundUVB,
      this.groundIB, this.groundCount);

    // ── Draw grass blades ────────────────────────────────────────────────────
    gl.useProgram(this.progBill);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.grassIB);
    this._setAttr(this.progBill, this.grassQuadVB, 'aPos', 3);
    this._setAttr(this.progBill, this.grassQuadUVB, 'aUV', 2);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progBill,'uVP'), false, vp);
    gl.uniform3fv(gl.getUniformLocation(this.progBill,'uCamRight'), camRight);
    gl.uniform1f(gl.getUniformLocation(this.progBill,'uFogNear'), fogNear);
    gl.uniform1f(gl.getUniformLocation(this.progBill,'uFogFar'),  fogFar);
    gl.uniform4fv(gl.getUniformLocation(this.progBill,'uFogColor'), fogCol);
    const gc = lvl.grassColor;

    this._grassInstances.forEach(g => {
      const dx = g.x - p.x, dz = g.z - p.z;
      if (dx*dx+dz*dz > fogFar*fogFar) return; // cull distant
      const sway = Math.sin(this.time*1.2 + g.x*0.3 + g.z*0.3) * 0.04;
      const cx = g.x + sway * Math.cos(g.rot);
      const cz = g.z + sway * Math.sin(g.rot);
      gl.uniform3fv(gl.getUniformLocation(this.progBill,'uCenter'), [cx, 0, cz]);
      gl.uniform2fv(gl.getUniformLocation(this.progBill,'uSize'), [g.scale, g.scale*1.5]);
      // Slight color variation per blade
      const t = (Math.sin(g.x*0.4)*0.5+0.5)*0.25;
      gl.uniform4fv(gl.getUniformLocation(this.progBill,'uColor'),
        [gc[0]+t*0.1, gc[1]+t*0.08, gc[2]-t*0.05, 1.0]);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });

    // ── Draw keys ────────────────────────────────────────────────────────────
    gl.useProgram(prog);
    lvl.items.forEach((item, i) => {
      if (this.world.isItemCollected(this.world.levelIndex, i)) return;
      const bob = Math.sin(this.time*2 + i)*0.15 + 1.0;
      const rot = this.time*1.5 + i*2.1;
      let m = mat4Translate(item.x, bob, item.z);
      m = mat4Multiply(m, mat4RotY(rot));
      const mvp2 = mat4Multiply(vp, m);
      this._setMainUniforms(prog, mvp2, m, sunDir, amb, [0.9,0.78,0.2], fogCol, fogNear, fogFar);
      this._drawMesh(prog, this.keyVB, this.keyNB, null, this.keyIB, this.keyIdxCount);
    });

    // ── Draw doors + frames ───────────────────────────────────────────────────
    lvl.doors.forEach(door => {
      const ready = this.world.canOpenDoor();
      const glowP = Math.abs(Math.sin(this.time*1.8)) * 0.3 + 0.15;
      const doorCol = ready
        ? [0.5+glowP, 0.85+glowP*0.3, 0.6+glowP*0.2]
        : [0.25, 0.28, 0.35];

      const dm = mat4Translate(door.x, 2, door.z);
      const dmvp = mat4Multiply(vp, dm);
      this._setMainUniforms(prog, dmvp, dm, sunDir, amb, doorCol, fogCol, fogNear, fogFar);
      this._drawMesh(prog, this.doorVB, this.doorNB, null, this.doorIB, this.doorIdxCount);

      // Pillars
      [-1.25, 1.25].forEach(ox => {
        const pm = mat4Translate(door.x + ox, 2.25, door.z);
        const pmvp = mat4Multiply(vp, pm);
        const pCol = [0.55, 0.52, 0.44];
        this._setMainUniforms(prog, pmvp, pm, sunDir, amb, pCol, fogCol, fogNear, fogFar);
        this._drawMesh(prog, this.pillarVB, this.pillarNB, null, this.pillarIB, this.pillarIdxCount);
      });
    });
  }

  // ── GL helpers ─────────────────────────────────────────────────────────────
  _setAttr(prog, buf, name, size) {
    const gl  = this.gl;
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  _setMainUniforms(prog, mvp, model, sunDir, amb, color, fogCol, fogNear, fogFar) {
    const gl = this.gl;
    gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uMVP'),   false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uModel'), false, model);
    gl.uniform3fv(gl.getUniformLocation(prog,'uSunDir'),  sunDir);
    gl.uniform3fv(gl.getUniformLocation(prog,'uAmbient'), amb);
    gl.uniform3fv(gl.getUniformLocation(prog,'uColor'),   color);
    gl.uniform4fv(gl.getUniformLocation(prog,'uFogColor'),fogCol);
    gl.uniform1f(gl.getUniformLocation(prog,'uFogNear'),  fogNear);
    gl.uniform1f(gl.getUniformLocation(prog,'uFogFar'),   fogFar);
    gl.uniform1f(gl.getUniformLocation(prog,'uUseTexture'), 0);
  }

  _drawMesh(prog, vb, nb, uvb, ib, count) {
    const gl = this.gl;
    this._setAttr(prog, vb, 'aPos', 3);
    if (nb) this._setAttr(prog, nb, 'aNorm', 3);
    if (uvb) this._setAttr(prog, uvb, 'aUV', 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
  }

  // ── Pause / resume ─────────────────────────────────────────────────────────
  pause()  { this.running = false; cancelAnimationFrame(this.frameId); }
  resume() { if (!this.running) { this.running = true; this._loop(); } }

  getSaveData() {
    return {
      player: this.player.toSave(),
      world:  this.world.toSave()
    };
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
window.gameInstance = null;

function startGameSession(user, saveData) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  window.gameInstance = new Game();
  window.gameInstance.init(user, saveData);
}

// ── Loading sequence on page load ────────────────────────────────────────────
window.addEventListener('load', () => {
  const steps = [
    [15,  'Generando terreno…'],
    [35,  'Dispersando hierba…'],
    [55,  'Colocando entidades…'],
    [72,  'Iniciando motor de física…'],
    [88,  'Preparando audio ambiental…'],
    [100, 'Listo para entrar…'],
  ];
  let i = 0;
  function nextStep() {
    if (i >= steps.length) {
      hideLoadingScreen(() => {
        document.getElementById('auth-screen').classList.remove('hidden');
      });
      return;
    }
    const [pct, text] = steps[i++];
    setLoadingProgress(pct, text);
    setTimeout(nextStep, 420 + Math.random()*300);
  }
  setTimeout(nextStep, 300);
});
