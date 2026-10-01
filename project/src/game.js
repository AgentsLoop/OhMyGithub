import * as THREE from 'three';
import { clamp, lerp, formatTime, damageCalc, scoreForKill } from './flightModel.js';

export class Game{
  constructor(){
    this.canvas = document.getElementById('c');
    this.overlay = document.getElementById('overlay');
    this.playBtn = document.getElementById('playBtn');
    this.menuText = document.getElementById('menuText');
    this.statusLine = document.getElementById('statusLine');
    this.reticle = document.getElementById('reticle');
    this.lockText = document.getElementById('lockText');
    this.hitFlash = document.getElementById('hitFlash');
    this.scorePop = document.getElementById('scorePop');
    this.radar = document.getElementById('radar');
    this.radarCtx = this.radar ? this.radar.getContext('2d') : null;

    // state
    this.state='menu'; // menu, playing, paused, won, lost
    this.timeLeft=120;
    this.score=0;
    this.kills=0;
    this.ammoMissiles=4;
    this.health=100;
    this.throttle=0.55;
    this.speed=135;
    this.altitude=320;
    this.lastFire=0;
    this.lastMissile=0;
    this.combo=0;
    this.comboTimer=0;

    // input
    this.keys={};
    this.shootHeld=false;

    // three
    this.scene=null; this.camera=null; this.renderer=null;
    this.player=null; this.ground=null; this.runway=null;
    this.bullets=[]; this.missiles=[]; this.enemies=[]; this.explosions=[]; this.clouds=[];
    this.clock=new THREE.Clock();
    this.cameraOffset = new THREE.Vector3(0, 8, -38);
    this.cameraLook = new THREE.Vector3(0, -1, 40);
    this.velocity = new THREE.Vector3(0,0,180);
    this.angVel = { pitch:0, roll:0, yaw:0 };
    this.targetYaw=0; this.targetPitch=0; this.targetRoll=0;
  }

  init(){
    this.setupThree();
    this.setupInput();
    this.setupScene();
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    this.playBtn.addEventListener('click', ()=>this.startGame());
    this.animate();
    this.updateHUD();
    // allow host header tunnel: show status
    this.statusLine.textContent='';
    // initial menu
    this.setState('menu');
  }

  setupThree(){
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1e2a4a, 0.00155);
    this.camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.12, 6000);
    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas, antialias:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.9));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  }

  setupInput(){
    addEventListener('keydown', e=>{
      const k=e.key.toLowerCase();
      this.keys[k]=true;
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
      if(k==='p' && this.state==='playing') this.setState('paused');
      else if(k==='p' && this.state==='paused') this.setState('playing');
      if(k==='r') this.startGame();
      if(k==='m' && this.state==='playing') this.fireMissile();
      if(k===' '){
        this.shootHeld=true;
        if(this.state==='menu' || this.state==='won' || this.state==='lost') this.startGame();
      }
      if(k==='enter' && this.state!=='playing') this.startGame();
    });
    addEventListener('keyup', e=>{
      const k=e.key.toLowerCase();
      this.keys[k]=false;
      if(k===' ') this.shootHeld=false;
    });
    // focus canvas for keyboard
    if(this.canvas){
      this.canvas.tabIndex=0;
      this.canvas.addEventListener('click', ()=>this.canvas.focus());
      // minimal touch controls for mobile QA
      let touchLeft=false, touchRight=false;
      this.canvas.addEventListener('touchstart', ev=>{
        ev.preventDefault();
        for(const t of ev.touches){
          const x=t.clientX/innerWidth;
          if(x<0.33) touchLeft=true;
          else if(x>0.66) touchRight=true;
          else this.shootHeld=true;
        }
        this.keys['a']=touchLeft; this.keys['d']=touchRight;
      }, {passive:false});
      this.canvas.addEventListener('touchend', ev=>{
        ev.preventDefault();
        touchLeft=false; touchRight=false;
        if(ev.touches.length===0){ this.keys['a']=false; this.keys['d']=false; this.shootHeld=false; }
      }, {passive:false});
      this.canvas.addEventListener('touchmove', ev=>{
        ev.preventDefault();
      }, {passive:false});
    }
    // also allow on-screen fire button via bottombar tap
    const fireArea=document.getElementById('hud');
    if(fireArea){
      fireArea.style.pointerEvents='none';
      // keep HUD panels interactive for radar but allow canvas touch
    }
  }

   setupScene(){
    // Sky gradient — fixed inverted sunset: indigo zenith -> orange horizon, synced sun vector, higher tessellation + noise
    const skyGeo = new THREE.SphereGeometry(4200, 48, 32);
    const skyMat = new THREE.ShaderMaterial({
      side:THREE.BackSide,
      uniforms:{
        topColor:{value:new THREE.Color('#0d1530')},
        midColor:{value:new THREE.Color('#2a3a7a')},
        bottomColor:{value:new THREE.Color('#ff7b2e')},
        exponent:{value: 1.6}
      },
      vertexShader:`varying vec3 vWorldPosition; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader:`uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor; uniform float exponent; varying vec3 vWorldPosition;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec3 n = normalize(vWorldPosition);
          float h = n.y;
          float t = clamp((h+0.32)*0.95, 0.0, 1.0);
          // dither
          float d = hash(gl_FragCoord.xy)*0.015;
          vec3 col = mix(bottomColor, vec3(0.95,0.52,0.32), smoothstep(0.0,0.22, t));
          col = mix(col, midColor, smoothstep(0.18,0.55, t));
          col = mix(col, topColor, pow(max(t,0.0), exponent));
          col += d;
          // sun disk synced to directional light ~ (0.71,0.46,-0.53)
          float sun = smoothstep(0.988, 0.994, dot(n, normalize(vec3(0.71,0.46, -0.53))));
          col += sun*0.42*vec3(1.15,1.0,0.72);
          // horizon glow
          float horizon = exp(-pow(max(0.0, h+0.08)*18.0, 1.4))*0.38;
          col += horizon*vec3(1.0,0.55,0.28);
          gl_FragColor = vec4(col,1.0);
        }`
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // lighting
    const ambient = new THREE.HemisphereLight(0xffcc99, 0x0a1020, 0.85);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    sun.position.set(800, 520, -600);
    sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.near=10; sun.shadow.camera.far=2600;
    sun.shadow.camera.left=-900; sun.shadow.camera.right=900; sun.shadow.camera.top=900; sun.shadow.camera.bottom=-900;
    sun.shadow.bias=-0.0004;
    this.scene.add(sun);
    // fill
    const fill = new THREE.DirectionalLight(0x8aa0ff, 0.45);
    fill.position.set(-400, 260, 500);
    this.scene.add(fill);

    // Terrain with subtle undulation restored (was zeroed before)
    const groundGeo = new THREE.PlaneGeometry(7000, 7000, 64, 64);
    const pos = groundGeo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), y=pos.getY(i);
      const h = Math.sin(x*0.002)*18 + Math.cos(y*0.0015)*22 + Math.sin((x+y)*0.0009)*12;
      pos.setZ(i, h*0.35);
    }
    pos.needsUpdate=true; groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({color:0x182a3a, roughness:0.95, metalness:0.02});
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI/2;
    this.ground.position.y = -42;
    this.ground.receiveShadow=true;
    this.scene.add(this.ground);

    // Runway
    const rwLen=4200, rwW=64;
    const rwGeo = new THREE.PlaneGeometry(rwW, rwLen);
    const rwMat = new THREE.MeshStandardMaterial({color:0x0f1420, roughness:0.55, metalness:0.12});
    this.runway = new THREE.Mesh(rwGeo, rwMat);
    this.runway.rotation.x = -Math.PI/2;
    this.runway.position.y = -40.5;
    this.runway.position.z = 180;
    this.runway.receiveShadow=true;
    this.scene.add(this.runway);
    // center line + markings (denser for motion readability, polygonOffset to kill Z-fight)
    const lineMat = new THREE.MeshStandardMaterial({color:0xfff8e1, emissive:0xfff8e1, emissiveIntensity:0.06, roughness:0.8});
    lineMat.polygonOffset=true; lineMat.polygonOffsetFactor=-1;
    for(let z=-1800; z<1900; z+=60){
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 22), lineMat);
      dash.rotation.x=-Math.PI/2;
      dash.position.set(0, -40.18, z);
      this.scene.add(dash);
    }
    const edgeMat = new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xffffff, emissiveIntensity:0.04});
    edgeMat.polygonOffset=true; edgeMat.polygonOffsetFactor=-1;
    const edgeL = new THREE.Mesh(new THREE.PlaneGeometry(1.4, rwLen), edgeMat);
    edgeL.rotation.x=-Math.PI/2; edgeL.position.set(-rwW/2+1.2, -40.18, 180);
    this.scene.add(edgeL);
    const edgeR = new THREE.Mesh(new THREE.PlaneGeometry(1.4, rwLen), edgeMat);
    edgeR.rotation.x=-Math.PI/2; edgeR.position.set(rwW/2-1.2, -40.18, 180); this.scene.add(edgeR);
    // threshold
    const thr = new THREE.Mesh(new THREE.PlaneGeometry(rwW-6, 18), edgeMat);
    thr.rotation.x=-Math.PI/2; thr.position.set(0,-40.16, -1900); this.scene.add(thr);
    // approach lights
    for(let i=0;i<10;i++){
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8), new THREE.MeshBasicMaterial({color:0xff3b3b}));
      l.position.set(-18 + (i%2?36:0), -39, -1880 - i*38);
      this.scene.add(l);
    }

    // runway side lights posts (fixed clone bug)
    for(let z=-1800; z<1800; z+=180){
      const mat = new THREE.MeshStandardMaterial({color:0x1f2937});
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,6,6), mat);
      postL.position.set(-38, -38, z); this.scene.add(postL);
      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,6,6), mat);
      postR.position.set(38, -38, z); this.scene.add(postR);
    }

    // some hangars / buildings low poly along runway
    for(let i=0;i<7;i++){
      const bx = (i%2?1:-1)*(70 + Math.random()*60);
      const bz = -1400 + i*420;
      const bd = new THREE.Mesh(new THREE.BoxGeometry(28+Math.random()*22, 18+Math.random()*14, 36), new THREE.MeshStandardMaterial({color:0x1e2b3d}));
      bd.position.set(bx, -31, bz); bd.castShadow=true; bd.receiveShadow=true; this.scene.add(bd);
    }

    // Player aircraft (procedural jet)
    this.player = this.createJet(0x8ecbff, true);
    this.player.position.set(0, 46, 220);
    this.scene.add(this.player);
    // shadow helper under player
    this.shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(14,22), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.28}));
    this.shadowDisc.rotation.x=-Math.PI/2; this.shadowDisc.position.y=-40.4;
    this.scene.add(this.shadowDisc);

    // clouds — warm tinted to match sunset fog, not pure white
    for(let i=0;i<22;i++){
      const c = new THREE.Mesh(new THREE.SphereGeometry(42+Math.random()*38, 12,9), new THREE.MeshStandardMaterial({color:0xffe4cc, transparent:true, opacity:0.38, roughness:1}));
      const ang = Math.random()*Math.PI*2;
      const rad = 700 + Math.random()*1600;
      c.position.set(Math.cos(ang)*rad, 340 + Math.random()*520, Math.sin(ang)*rad);
      c.scale.set(1.8,0.85,1.2);
      this.scene.add(c); this.clouds.push(c);
    }

    // initial enemies
    this.spawnEnemies(5);
  }

  createJet(color, isPlayer){
    const g = new THREE.Group();
    // fuselage
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.0, 32, 12), new THREE.MeshStandardMaterial({color:isPlayer?0xdbeafe:0x9ca3af, roughness:0.35, metalness:0.35}));
    fus.rotation.x=Math.PI/2; fus.position.z= -2; fus.castShadow=true; g.add(fus);
    // nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 8, 12), new THREE.MeshStandardMaterial({color:isPlayer?0xf1f5f9:0xe5e7eb, roughness:0.3}));
    nose.rotation.x=-Math.PI/2; nose.position.z= -20; nose.castShadow=true; g.add(nose);
    // cockpit
    const cock = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 6, 6,10), new THREE.MeshStandardMaterial({color:0x0ea5e9, roughness:0.18, metalness:0.6, transparent:true, opacity:0.92}));
    cock.rotation.x=Math.PI/2; cock.position.set(0,1.1,-6); g.add(cock);
    // wings
    const wingGeo = new THREE.BoxGeometry(26, 0.6, 7);
    const wing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({color:color, roughness:0.5}));
    wing.position.set(0, -0.3, -4); wing.castShadow=true; g.add(wing);
    // tail fin
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 6), new THREE.MeshStandardMaterial({color:isPlayer?0x38bdf8:0x6b7280}));
    tail.position.set(0,2.2, 8); tail.castShadow=true; g.add(tail);
    // horizontal stabilizers
    const stab = new THREE.Mesh(new THREE.BoxGeometry(9,0.4,3.2), new THREE.MeshStandardMaterial({color:color}));
    stab.position.set(0,0.4,9.5); g.add(stab);
    // engine nozzles
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.4,2.2,10), new THREE.MeshStandardMaterial({color:0x111827, emissive:0xff6b2d, emissiveIntensity: isPlayer?0.9:0.5}));
    noz.rotation.x=Math.PI/2; noz.position.set(0, -0.6, 11.2); g.add(noz);
    g.userData.nozzle=noz;
    // propeller glow for feedback
    if(isPlayer){
      const glow = new THREE.Mesh(new THREE.CircleGeometry(1.6,12), new THREE.MeshBasicMaterial({color:0xff7a18, transparent:true, opacity:0.0}));
      glow.position.set(0,-0.6,12.4); glow.rotation.y=Math.PI; g.add(glow); g.userData.glow=glow;
    }
    g.rotation.order='YXZ';
    return g;
  }

  spawnEnemies(n){
    for(let i=0;i<n;i++) this.spawnOneEnemy();
  }
  spawnOneEnemy(){
    const e = this.createJet(0x9ca3af, false);
    const ang = Math.random()*Math.PI*2;
    const rad = 420 + Math.random()*860;
    e.position.set(Math.cos(ang)*rad*0.9, 120 + Math.random()*260, Math.sin(ang)*rad*0.6 - 400 - Math.random()*900);
    e.rotation.y = Math.random()*Math.PI*2;
    e.userData.hp=3;
    e.userData.maxHp=3;
    e.userData.vel = new THREE.Vector3(0,0,0);
    e.userData.shootCd = 1 + Math.random()*2;
    // simple patrol center
    e.userData.base = e.position.clone();
    this.scene.add(e);
    this.enemies.push(e);
  }

  setState(s){
    this.state=s;
    if(s==='menu'){
      this.overlay.classList.remove('hidden');
      this.playBtn.textContent='Launch • Press Space';
      this.menuText.textContent='Bandits swarm the rift over the burning sunset. Hold the runway corridor, stay fast, and splash 12 bogeys before fuel runs out. Watch your altitude — the deck is hard.';
    } else if(s==='playing'){
      this.overlay.classList.add('hidden');
    } else if(s==='paused'){
      this.overlay.classList.remove('hidden');
      this.playBtn.textContent='Resume';
      this.menuText.textContent='Paused — get back in the fight.';
    } else if(s==='won'){
      this.overlay.classList.remove('hidden');
      this.playBtn.textContent='Fly Again';
      this.menuText.innerHTML=`<b style="color:#4ade80">Rift Secured!</b> You splashed ${this.kills} bandits. Score ${this.score}. The runway is yours.`;
    } else if(s==='lost'){
      this.overlay.classList.remove('hidden');
      this.playBtn.textContent='Retry';
      const reason = this.health<=0 ? 'Aircraft lost — you took too much fire.' : this.altitude<18 ? 'Controlled flight into terrain.' : 'Fuel exhausted.';
      this.menuText.innerHTML=`<b style="color:#f87171">Eject! Eject!</b> ${reason} Score ${this.score}.`;
    }
  }

  startGame(){
    // reset
    this.timeLeft=120;
    this.score=0;
    this.kills=0;
    this.health=100;
    this.throttle=0.58;
    this.speed=140;
    this.altitude=340;
    this.combo=0; this.comboTimer=0;
    this.ammoMissiles=4;
    this.player.position.set(0,46,220);
    this.player.rotation.set(0,0,0);
    this.targetPitch=0; this.targetRoll=0; this.targetYaw=0;
    this.angVel={pitch:0, roll:0, yaw:0};
    this.velocity.set(0,0,170);
    // clear projectiles
    for(const b of this.bullets) this.scene.remove(b);
    for(const m of this.missiles) this.scene.remove(m);
    for(const ex of this.explosions) this.scene.remove(ex.group);
    this.bullets=[]; this.missiles=[]; this.explosions=[];
    // reset enemies
    for(const e of this.enemies) this.scene.remove(e);
    this.enemies=[];
    this.spawnEnemies(5);
    this.setState('playing');
    this.clock.getDelta(); // reset
    this.canvas.focus();
  }

  fireGun(){
    const now = performance.now();
    if(now - this.lastFire < 78) return;
    this.lastFire=now;
    const origin = this.player.position.clone();
    origin.y -= 0.4;
    // two guns offset
    for(let side of [-1,1]){
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.55,6,6), new THREE.MeshBasicMaterial({color:0xfff6a3}));
      b.position.copy(origin);
      b.position.x += side*3.1;
      b.position.z -= 6;
      b.userData.vel = this.getForward().multiplyScalar(520);
      // add player velocity
      b.userData.vel.add(this.velocity.clone().multiplyScalar(0.35));
      b.userData.life=1.4;
      this.scene.add(b);
      this.bullets.push(b);
    }
    // muzzle flash
    this.player.userData.glow.material.opacity=0.9;
    setTimeout(()=>{ if(this.player.userData.glow) this.player.userData.glow.material.opacity=0; }, 60);
    // slight screenshake via camera offset tweak
    this.cameraShake=0.7;
  }

  fireMissile(){
    const now = performance.now();
    if(now - this.lastMissile < 650) return;
    if(this.ammoMissiles<=0){
      this.popText('No missiles!');
      return;
    }
    this.ammoMissiles--; this.lastMissile=now;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,7,8), new THREE.MeshStandardMaterial({color:0xe2e8f0}));
    m.rotation.x=Math.PI/2;
    m.position.copy(this.player.position); m.position.z -= 8;
    m.userData.vel = this.getForward().multiplyScalar(280);
    m.userData.life=5;
    m.userData.target = this.findClosestEnemy() || null;
    // trail
    const trail = new THREE.Mesh(new THREE.SphereGeometry(0.9,6,6), new THREE.MeshBasicMaterial({color:0xff7a18, transparent:true, opacity:0.9}));
    m.userData.trail=trail; this.scene.add(trail);
    this.scene.add(m); this.missiles.push(m);
  }

  getForward(){
    const dir = new THREE.Vector3(0,0,-1);
    dir.applyEuler(this.player.rotation);
    return dir;
  }

  findClosestEnemy(){
    let best=null, bestD=1e9;
    const p = this.player.position;
    for(const e of this.enemies){
      const d = p.distanceTo(e.position);
      if(d<bestD){bestD=d; best=e;}
    }
    return best;
  }

  popText(t){
    this.scorePop.textContent=t;
    this.scorePop.style.opacity='1';
    this.scorePop.style.transform='translate(-50%,-60%)';
    setTimeout(()=>{
      this.scorePop.style.opacity='0';
      this.scorePop.style.transform='translate(-50%,-80%)';
    }, 650);
  }

  triggerHitFlash(){
    this.hitFlash.classList.add('on');
    setTimeout(()=>this.hitFlash.classList.remove('on'), 120);
  }

  createExplosion(pos, color=0xff6a2a){
    const g=new THREE.Group();
    g.position.copy(pos);
    const core = new THREE.Mesh(new THREE.SphereGeometry(3.2,12,10), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95}));
    g.add(core);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2,5,20), new THREE.MeshBasicMaterial({color:0xfff1a8, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
    ring.rotation.x=Math.PI/2; g.add(ring);
    // debris
    for(let i=0;i<6;i++){
      const d=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.9), new THREE.MeshStandardMaterial({color:0x44403c}));
      d.position.set((Math.random()-0.5)*4,(Math.random()-0.5)*4,(Math.random()-0.5)*4);
      d.userData.vel=new THREE.Vector3((Math.random()-0.5)*42, Math.random()*28, (Math.random()-0.5)*42);
      g.add(d);
    }
    this.scene.add(g);
    this.explosions.push({group:g, core, ring, t:0, life:0.95});
  }

  resize(){
    const w=innerWidth, h=innerHeight;
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h);
  }

  updateFlight(dt){
    if(this.state!=='playing') return;
    // read inputs with invert support (W inverted like Ace)
    let pitchIn=0, rollIn=0, yawIn=0, thrDelta=0;
    if(this.keys['w'] || this.keys['arrowup']) pitchIn -=1;
    if(this.keys['s'] || this.keys['arrowdown']) pitchIn +=1;
    if(this.keys['a'] || this.keys['arrowleft']) rollIn -=1;
    if(this.keys['d'] || this.keys['arrowright']) rollIn +=1;
    if(this.keys['q']) yawIn -=1;
    if(this.keys['e']) yawIn +=1;
    if(this.keys['shift']) thrDelta+=1;
    if(this.keys['control'] || this.keys['ctrl']) thrDelta-=1;

    // smooth target angles with exponential curve for game feel
    const curve = (v)=> Math.sign(v)*Math.pow(Math.abs(v),1.35);
    this.targetPitch = clamp(curve(pitchIn)*0.48, -0.48, 0.48);
    this.targetRoll = clamp(curve(rollIn)*0.95 + yawIn*0.35, -1.1, 1.1);
    this.targetYaw += yawIn*dt*0.6 + rollIn*dt*0.45;

    // angular inertia via damped spring
    const ax = (this.targetPitch - this.player.rotation.x)*8;
    const az = (-this.targetRoll - this.player.rotation.z)*8;
    this.angVel.pitch = lerp(this.angVel.pitch, ax, dt*6);
    this.angVel.roll  = lerp(this.angVel.roll,  az, dt*6);
    this.angVel.pitch *= (1 - dt*1.8);
    this.angVel.roll  *= (1 - dt*1.8);
    this.player.rotation.x += this.angVel.pitch*dt;
    this.player.rotation.z += this.angVel.roll*dt;
    this.player.rotation.y = lerp(this.player.rotation.y, this.targetYaw, dt*1.8);

    // throttle with afterburner feel + energy bleed in bank
    this.throttle = clamp(this.throttle + thrDelta*dt*0.55, 0.10, 1);
    const bankBleed = Math.abs(this.player.rotation.z)*0.14*dt;
    const targetSpeed = 62 + this.throttle*205 - bankBleed*90;
    this.speed = lerp(this.speed, targetSpeed, dt*1.4);
    // afterburner FOV kick
    const wantFOV = this.throttle>0.92 ? 78 : 72;
    this.camera.fov = lerp(this.camera.fov, wantFOV, dt*2.2);
    this.camera.updateProjectionMatrix();
    // engine glow pulse on afterburner
    if(this.player.userData.glow){
      this.player.userData.nozzle.material.emissiveIntensity = 0.6 + this.throttle*0.7;
    }

    // forward motion
    const fwd = this.getForward();
    // add slight lift from pitch
    const desiredVel = fwd.multiplyScalar(this.speed);
    this.velocity.lerp(desiredVel, dt*1.6);
    // gravity / drag altitude effect
    this.velocity.y -= 9.8*dt*0.72;
    // simple lift when pitched up and fast
    this.velocity.y += ( -this.player.rotation.x) * this.speed * dt * 0.16;

    this.player.position.addScaledVector(this.velocity, dt);

    // bounds: keep within playable box, softly push back
    const p=this.player.position;
    // clamp X / Z corridor
    if(Math.abs(p.x)>1450) p.x = clamp(p.x, -1450,1450);
    if(p.z < -2000) p.z = -2000;
    if(p.z > 1100) p.z = 1100;

    // altitude from y
    this.altitude = Math.max(0, Math.round((p.y + 42)*3.28)); // convert to ft approx
    // forgiving ground collision with cooldown
    if(!this._groundHitAt) this._groundHitAt=0;
    if(p.y < -28){
      p.y=-28;
      this.velocity.y = Math.max(0, this.velocity.y * 0.35);
      const now=performance.now();
      if(this.speed>95 && now - this._groundHitAt > 800){
        this._groundHitAt=now;
        this.health = damageCalc(this.health, 28);
        this.triggerHitFlash();
        this.createExplosion(p.clone(), 0xf97316);
        if(this.health<=0) this.setState('lost');
      }
    }
    if(p.y > 920) p.y=920;

    // drag clouds opposite direction slightly for parallax
    for(const c of this.clouds){
      c.position.z += dt*14; // drift
      if(c.position.z>1200) c.position.z -= 3600;
    }

    // update shadow
    this.shadowDisc.position.x=p.x;
    this.shadowDisc.position.z=p.z;
    const h = Math.max(0, p.y+40);
    this.shadowDisc.material.opacity = clamp(0.32 - h*0.0009, 0.02, 0.32);
    this.shadowDisc.scale.setScalar(clamp(2.2 - h*0.002, 0.5, 2.2));

    // auto fire
    if(this.shootHeld) this.fireGun();

    // time
    this.timeLeft -= dt;
    if(this.timeLeft<=0){
      this.timeLeft=0;
      if(this.kills>=12) this.setState('won'); else this.setState('lost');
    }
    // combo decay
    this.comboTimer -= dt;
    if(this.comboTimer<=0) this.combo=0;

    // check win
    if(this.kills>=12) this.setState('won');
    // crash check
    if(this.altitude<18 && this.speed>60){
      // allow brief low pass but damage over time if scraping
      this.health -= dt*14;
      if(this.health<=0) this.setState('lost');
    }
  }

  updateEnemies(dt){
    if(this.state!=='playing') return;
    // spawn more if low
    if(this.enemies.length<4 && Math.random()<0.02) this.spawnOneEnemy();
    if(this.enemies.length<7 && this.timeLeft%18 <0.05) this.spawnOneEnemy();

    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i];
      // AI: fly towards player with lead + weave
      const toPlayer = new THREE.Vector3().subVectors(this.player.position, e.position);
      const dist = toPlayer.length();
      toPlayer.normalize();
      // steer
      const curFwd = new THREE.Vector3(0,0,-1).applyEuler(e.rotation);
      const steer = toPlayer.clone().sub(curFwd).multiplyScalar(dt*0.9);
      // add weave
      const weave = Math.sin(performance.now()*0.001 + i)*0.18;
      e.rotation.y += steer.x*1.2 + weave*dt*0.5;
      e.rotation.x += steer.y*0.9;
      e.rotation.z = Math.sin(performance.now()*0.0012 + i)*0.45;

      const spd = 88 + (i%3)*18; // varied
      e.position.addScaledVector(curFwd, spd*dt);
      // keep altitude
      if(e.position.y < 20) e.position.y=20;
      if(e.position.y>680) e.position.y=680;
      // enemy shooting
      e.userData.shootCd -= dt;
      if(dist<520 && e.userData.shootCd<=0){
        // simple ray towards player: chance to hit
        if(dist<360 && Math.random()<0.10){
          this.health = damageCalc(this.health, 7);
          this.triggerHitFlash();
          this.createExplosion(this.player.position.clone().add(new THREE.Vector3((Math.random()-0.5)*6, (Math.random()-0.5)*4, (Math.random()-0.5)*6)), 0xfbbf24);
          if(this.health<=0) this.setState('lost');
        }
        e.userData.shootCd = 1.2 + Math.random()*1.4;
        // tracer
        const tracer = new THREE.Mesh(new THREE.SphereGeometry(1.0,6,6), new THREE.MeshBasicMaterial({color:0xff3b3b}));
        tracer.position.copy(e.position); tracer.position.z -=6;
        tracer.userData.vel = toPlayer.clone().multiplyScalar(420);
        tracer.userData.life=1.0;
        this.scene.add(tracer); this.bullets.push(tracer); // reuse for simplicity but mark as enemy
        tracer.userData.isEnemy=true;
      }
      // wrap around bounds
      if(e.position.distanceTo(this.player.position)>2700){
        e.position.set((Math.random()-0.5)*900, 180+Math.random()*320, this.player.position.z - 900 - Math.random()*700);
      }
    }
  }

  updateProjectiles(dt){
    // bullets
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i];
      b.position.addScaledVector(b.userData.vel, dt);
      b.userData.life -= dt;
      // trail stretch
      b.scale.z = 1 + b.userData.vel.length()*0.002;
      if(b.userData.life<=0){
        this.scene.remove(b); this.bullets.splice(i,1); continue;
      }
      if(b.userData.isEnemy){
        // check vs player
        if(b.position.distanceTo(this.player.position)<11){
          this.health = damageCalc(this.health, 9);
          this.triggerHitFlash();
          this.scene.remove(b); this.bullets.splice(i,1);
          if(this.health<=0) this.setState('lost');
          continue;
        }
        // vs terrain
        if(b.position.y < -38) { this.scene.remove(b); this.bullets.splice(i,1); }
        continue;
      }
      // player bullet vs enemies
      let hit=false;
      for(let j=this.enemies.length-1;j>=0;j--){
        const e=this.enemies[j];
        if(b.position.distanceTo(e.position)<13){
          e.userData.hp -=1;
          this.scene.remove(b); this.bullets.splice(i,1); hit=true;
          // hit fx
          this.createExplosion(e.position.clone(), 0xfde68a);
          e.position.addScaledVector(b.userData.vel.clone().normalize(), -3);
          if(e.userData.hp<=0){
            // kill
            this.createExplosion(e.position.clone(), 0xff6a2a);
            this.scene.remove(e);
            this.enemies.splice(j,1);
            this.kills++;
            const pts = scoreForKill(this.combo);
            this.score += pts;
            this.combo++; this.comboTimer=2.8;
            this.popText(`+${pts}${this.combo>1?` x${this.combo}`:''}`);
            // resupply missile every 3 kills (QA fix: guarantee winnability)
            if(this.kills%3===0) this.ammoMissiles = Math.min(4, this.ammoMissiles+1);
            // spawn replacement after delay
            setTimeout(()=>{ if(this.state==='playing' && this.enemies.length<6) this.spawnOneEnemy(); }, 900);
            if(this.kills>=12) this.setState('won');
          } else {
            // hit feedback: flash emissive
            e.traverse(c=>{ if(c.isMesh && c.material && c.material.emissive){ c.material.emissive.setHex(0xff4444); setTimeout(()=>c.material.emissive.setHex(0x000000),90); }});
          }
          break;
        }
      }
      if(hit) continue;
      if(b.position.y < -38 || b.position.length()>4200){ this.scene.remove(b); this.bullets.splice(i,1); }
    }
    // missiles
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];
      m.userData.life -= dt;
      // homing
      if(m.userData.target && this.enemies.includes(m.userData.target)){
        const dir = new THREE.Vector3().subVectors(m.userData.target.position, m.position).normalize();
        const cur = m.userData.vel.clone().normalize();
        const steer = dir.clone().sub(cur).multiplyScalar(dt*3.2);
        m.userData.vel.add(steer.multiplyScalar(320*dt));
        // clamp speed
        const spd = m.userData.vel.length();
        if(spd>420) m.userData.vel.normalize().multiplyScalar(420);
        // orient
        m.lookAt(m.position.clone().add(m.userData.vel));
      }
      m.position.addScaledVector(m.userData.vel, dt);
      if(m.userData.trail){
        m.userData.trail.position.copy(m.position);
        m.userData.trail.material.opacity = 0.85;
      }
      if(m.userData.life<=0){
        this.scene.remove(m); if(m.userData.trail) this.scene.remove(m.userData.trail);
        this.missiles.splice(i,1); continue;
      }
      // check hit vs enemies
      for(let j=this.enemies.length-1;j>=0;j--){
        const e=this.enemies[j];
        if(m.position.distanceTo(e.position)<16){
          this.createExplosion(e.position.clone(), 0xff7a18);
          this.scene.remove(e); this.enemies.splice(j,1);
          this.scene.remove(m); if(m.userData.trail) this.scene.remove(m.userData.trail);
          this.missiles.splice(i,1);
          this.kills++; this.score+=250; this.combo++; this.comboTimer=2.8;
          if(this.kills%3===0) this.ammoMissiles = Math.min(4, this.ammoMissiles+1);
          this.popText('+250 MISSILE');
          if(this.kills>=12) this.setState('won');
          break;
        }
      }
      if(m.position.y < -38){
        this.createExplosion(m.position.clone(), 0xff7a18);
        this.scene.remove(m); if(m.userData.trail) this.scene.remove(m.userData.trail);
        this.missiles.splice(i,1);
      }
    }
    // explosions
    for(let i=this.explosions.length-1;i>=0;i--){
      const ex=this.explosions[i];
      ex.t += dt;
      const p = ex.t/ex.life;
      ex.core.scale.setScalar(1 + p*4.2);
      ex.core.material.opacity = 0.9*(1-p);
      ex.ring.scale.setScalar(1 + p*3.5);
      ex.ring.material.opacity=0.8*(1-p);
      ex.group.position.y += dt*7;
      for(const child of ex.group.children){
        if(child.userData.vel){
          child.position.addScaledVector(child.userData.vel, dt);
          child.userData.vel.y -= 22*dt;
          child.rotation.x += dt*4; child.rotation.y+=dt*3;
        }
      }
      if(ex.t>=ex.life){ this.scene.remove(ex.group); this.explosions.splice(i,1); }
    }
  }

  updateCamera(dt){
    // damped chase cam with horizon stabilization (fix welded snap)
    const bank = this.player.rotation.z;
    const lateral = -bank*10;
    const localOffset = new THREE.Vector3(lateral, 8, -38);
    const targetPos = this.player.position.clone()
      .add(localOffset.applyQuaternion(this.player.quaternion))
      .add(new THREE.Vector3(0, 2.5, 0));
    const posLerp = 1 - Math.exp(-4.5*dt*60/60);
    this.camera.position.lerp(targetPos, posLerp);
    // bank-stabilized look: only 28% of roll goes to horizon
    const lookBase = this.player.position.clone()
      .add(new THREE.Vector3(0, 1.2, 55).applyQuaternion(this.player.quaternion));
    this.cameraLook.lerp(lookBase, 1 - Math.exp(-6*dt));
    // apply stabilized up
    this.camera.lookAt(this.cameraLook);
    // slight roll stabilization
    this.camera.rotation.z = lerp(this.camera.rotation.z, -bank*0.28, dt*3.0);
    if(this.cameraShake){
      this.cameraLook.x += (Math.random()-0.5)*this.cameraShake*0.6;
      this.cameraLook.y += (Math.random()-0.5)*this.cameraShake*0.6;
      this.cameraShake = Math.max(0, this.cameraShake - dt*4.2);
    }
  }

  updateHUD(){
    try{
    const byId=(id)=>document.getElementById(id);
    const sv=byId('speedVal'), av=byId('altVal'), tv=byId('thrVal'), tf=byId('throttleFill'), hf=byId('healthFill'), hv=byId('hpVal'), sc=byId('scoreVal'), kv=byId('killVal'), ti=byId('timeVal'), ec=byId('enemyCount'), am=byId('ammoVal');
    if(!sv||!av||!tv||!tf||!hf||!hv||!sc||!kv||!ti||!ec||!am) return;
    sv.textContent = Math.round(this.speed) + ' kts';
    av.textContent = Math.round(this.altitude) + ' ft';
    tv.textContent = Math.round(this.throttle*100) + '%';
    tf.style.width = (this.throttle*100)+'%';
    hf.style.width = this.health+'%';
    hf.style.background = this.health<30 ? 'linear-gradient(90deg,#ef4444,#fca5a5)' : this.health<60 ? 'linear-gradient(90deg,#f59e0b,#fde68a)' : 'linear-gradient(90deg,#22c55e,#86efac)';
    hv.textContent = Math.round(this.health)+'%';
    sc.textContent = this.score;
    kv.textContent = `${this.kills} / 12`;
    ti.textContent = formatTime(this.timeLeft);
    ec.textContent = `${this.enemies.length} bandits`;
    am.textContent = this.ammoMissiles;
    // reticle lock
    const closest = this.findClosestEnemy();
    let locked=false;
    if(closest && this.state==='playing'){
      const screenPos = closest.position.clone().project(this.camera);
      const dist2d = Math.hypot(screenPos.x, screenPos.y);
      const worldDist = closest.position.distanceTo(this.player.position);
      locked = worldDist<680 && dist2d < 0.42 && screenPos.z < 1;
      // also need in front
      const fwd = this.getForward();
      const to = new THREE.Vector3().subVectors(closest.position, this.player.position).normalize();
      const dot = fwd.dot(to);
      locked = locked && dot>0.74;
    }
    if(this.reticle) this.reticle.classList.toggle('lock', locked);
    if(this.lockText) this.lockText.classList.toggle('on', locked);
    // radar
    this.drawRadar();
    }catch(e){ console.warn('HUD error', e); }
  }

  drawRadar(){
    const ctx=this.radarCtx;
    if(!ctx) return;
    const W=140,H=140;
    ctx.clearRect(0,0,W,H);
    // grid
    ctx.strokeStyle='rgba(96,165,250,0.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(70,70,58,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(70,70,38,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(70,70,18,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(70,12); ctx.lineTo(70,128); ctx.moveTo(12,70); ctx.lineTo(128,70); ctx.stroke();
    // runway line
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(70,20); ctx.lineTo(70,120); ctx.stroke();
    // player
    ctx.fillStyle='#38bdf8'; ctx.beginPath(); ctx.arc(70,70,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(56,189,248,0.25)'; ctx.beginPath(); ctx.arc(70,70,8,0,Math.PI*2); ctx.fill();
    // enemies relative to player, top is forward (-Z)
    const scale=0.085;
    const yaw = this.player.rotation.y;
    const cos=Math.cos(-yaw), sin=Math.sin(-yaw);
    for(const e of this.enemies){
      const dx = e.position.x - this.player.position.x;
      const dz = e.position.z - this.player.position.z;
      const rx = dx*cos - dz*sin;
      const rz = dx*sin + dz*cos;
      const x = 70 + rx*scale;
      const y = 70 + rz*scale;
      if(x<4||x>136||y<4||y>136) continue;
      // heading chevron
      const heading = e.rotation.y - yaw;
      ctx.save(); ctx.translate(x,y); ctx.rotate(heading);
      ctx.fillStyle = e.userData.hp<=1 ? '#f87171' : '#facc15';
      ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(3.2,3); ctx.lineTo(-3.2,3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=0.9; ctx.stroke();
      ctx.restore();
      // altitude bracket
      const dzAlt = e.position.y - this.player.position.y;
      if(Math.abs(dzAlt)>60){
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText(dzAlt>0?'▲':'▼', x, y-8);
      }
    }
    // sweep
    const t=performance.now()*0.001;
    ctx.strokeStyle='rgba(56,189,248,0.45)'; ctx.beginPath(); ctx.moveTo(70,70); ctx.lineTo(70+Math.cos(t*1.6)*58, 70+Math.sin(t*1.6)*58); ctx.stroke();
  }

  animate(){
    requestAnimationFrame(()=>this.animate());
    try{
    const dt = Math.min(0.033, this.clock.getDelta());
    if(this.state==='playing'){
      this.updateFlight(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
    }
    this.updateCamera(dt);
    this.updateHUD();
    this.renderer.render(this.scene, this.camera);
    }catch(e){ console.error('frame error', e); }
  }
}
