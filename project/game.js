export function createGame(canvas, opts={}){
  const ctx = canvas.getContext('2d');
  const W = 900, H = 600;
  // helpers
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const rand=(a,b)=>a+Math.random()*(b-a);

  function spawnPosForWave(){
    // spawn at edge, away from player
    const side = Math.floor(Math.random()*4);
    let x,y;
    if(side===0){ x=-20; y=rand(0,H); }
    else if(side===1){ x=W+20; y=rand(0,H); }
    else if(side===2){ x=rand(0,W); y=-20; }
    else { x=rand(0,W); y=H+20; }
    // if too close to player, re-roll 60%
    if(player && Math.hypot(x-player.x, y-player.y) < 180 && Math.random()<0.7){
      return spawnPosForWave();
    }
    return {x,y};
  }

  const state = {
    score:0, wave:1, kills:0, time:0,
    maxHp:5, hp:5,
    playing:false, paused:false,
    enemies:[], particles:[], damageTexts:[],
    waveSpawned:0, waveTotal:5, waveCooldown:0,
    attackCooldown:0, attackActive:0,
    invuln:0,
    keys:{up:false,down:false,left:false,right:false},
    mouse:{x:W/2,y:H/2},
    facing:0,
    best:0
  };

  let player = { x:W/2, y:H/2, r:14, speed:240 };

  let audioCtx=null;
  let muted=false;
  function beep(freq, dur, vol=0.12, type='sine'){
    if(muted) return;
    try{
      if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended') audioCtx.resume();
      const o=audioCtx.createOscillator();
      const g=audioCtx.createGain();
      o.type=type; o.frequency.value=freq;
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.value=vol;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
      o.stop(audioCtx.currentTime+dur);
    }catch{}
  }

  function resetPlayer(){
    player.x=W/2; player.y=H/2;
    state.hp=state.maxHp;
    state.invuln=0;
  }

  function nextWaveSetup(){
    state.waveTotal = Math.min(18, 3 + state.wave*2);
    state.waveSpawned=0;
    state.waveCooldown=0;
  }

  function spawnEnemy(){
    const p = spawnPosForWave();
    // variant by wave and random
    const r = Math.random();
    let type='grunt', hp=2, speed= 85 + state.wave*6, radius=13, color='#fb7185';
    if(state.wave>=2 && r<0.22){ type='racer'; hp=1; speed=155 + state.wave*7; radius=10; color='#facc15'; }
    else if(state.wave>=3 && r>0.78){ type='tank'; hp=3; speed=62 + state.wave*3; radius=16; color='#a78bfa'; }
    else { speed += rand(-12,12); }
    state.enemies.push({
      x:p.x, y:p.y, hp, maxHp:hp, speed, radius, color, type,
      hitFlash:0, knockX:0, knockY:0
    });
    state.waveSpawned++;
  }

  // input
  const keyMap = {
    'KeyW':'up','ArrowUp':'up',
    'KeyS':'down','ArrowDown':'down',
    'KeyA':'left','ArrowLeft':'left',
    'KeyD':'right','ArrowRight':'right',
  };
  window.addEventListener('keydown', e=>{
    const dir = keyMap[e.code];
    if(dir) state.keys[dir]=true;
  });
  window.addEventListener('keyup', e=>{
    const dir = keyMap[e.code];
    if(dir) state.keys[dir]=false;
  });
  canvas.addEventListener('mousemove', e=>{
    const rect=canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    state.mouse.x = (e.clientX - rect.left)*sx;
    state.mouse.y = (e.clientY - rect.top)*sy;
    // update facing from mouse when not moving
  });

  function attack(){
    if(!state.playing || state.paused) return false;
    if(state.attackCooldown>0) return false;
    state.attackActive=0.15;
    state.attackCooldown=0.35;
    beep(620,0.08,0.14,'square');
    // damage check immediate
    // cone in facing direction, plus close omnidirectional
    const range=68;
    const closeRange=34;
    const cone = 120 * Math.PI/180;
    let hits=0;
    for(const en of state.enemies){
      const d = Math.hypot(en.x-player.x, en.y-player.y);
      if(d>range) continue;
      let inRange=false;
      if(d < closeRange) inRange=true;
      else {
        const ang = Math.atan2(en.y-player.y, en.x-player.x);
        let diff = ang - state.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if(Math.abs(diff) < cone/2) inRange=true;
      }
      if(inRange){
        en.hp--;
        en.hitFlash=0.18;
        // knockback
        const nx = (en.x-player.x)/ (d||1);
        const ny = (en.y-player.y)/ (d||1);
        en.knockX = nx * 220;
        en.knockY = ny * 220;
        hits++;
        // particles
        for(let i=0;i<6;i++) state.particles.push({
          x:en.x, y:en.y, vx:rand(-120,120), vy:rand(-120,120), life:0.35, r:rand(2,4), color:en.color
        });
        state.damageTexts.push({x:en.x, y:en.y-10, vy:-42, life:0.6, text:'-1'});
        if(en.hp<=0){
          // death
          state.kills++;
          state.score+=10;
          beep(180,0.12,0.18,'sawtooth');
          for(let i=0;i<10;i++) state.particles.push({
            x:en.x, y:en.y, vx:rand(-180,180), vy:rand(-180,180), life:0.5, r:rand(2,5), color:en.color
          });
        }
      }
    }
    if(hits>0) beep(880,0.06,0.12,'triangle');
    // remove dead after loop to avoid skipping
    const before = state.enemies.length;
    state.enemies = state.enemies.filter(e=>e.hp>0);
    const killed = before - state.enemies.length;
    if(killed>0 && opts.onShake) opts.onShake();
    return true;
  }

  function takeDamage(){
    if(state.invuln>0) return;
    state.hp--;
    state.invuln=0.85;
    beep(120,0.25,0.2,'sawtooth');
    if(opts.onShake) opts.onShake();
    // flash particles on player
    for(let i=0;i<8;i++) state.particles.push({x:player.x,y:player.y,vx:rand(-140,140),vy:rand(-140,140),life:0.4,r:3,color:'#38bdf8'});
    if(state.hp<=0){
      state.playing=false;
      state.paused=false;
      if(opts.onGameOver) opts.onGameOver({score:state.score,wave:state.wave,kills:state.kills,time: Math.floor(state.time/60)+':'+String(Math.floor(state.time%60)).padStart(2,'0')});
    }
  }

  function update(dt){
    if(!state.playing || state.paused) return;
    state.time+=dt;

    // cooldowns
    if(state.attackActive>0) state.attackActive-=dt;
    if(state.attackCooldown>0) state.attackCooldown-=dt;
    if(state.invuln>0) state.invuln-=dt;

    // movement
    let mx=0,my=0;
    if(state.keys.left) mx-=1;
    if(state.keys.right) mx+=1;
    if(state.keys.up) my-=1;
    if(state.keys.down) my+=1;
    const mag = Math.hypot(mx,my);
    if(mag>0){ mx/=mag; my/=mag; player.x+=mx*player.speed*dt; player.y+=my*player.speed*dt;
      state.facing = Math.atan2(my,mx);
    } else {
      // face mouse
      const dx = state.mouse.x - player.x;
      const dy = state.mouse.y - player.y;
      if(Math.hypot(dx,dy)>8) state.facing = Math.atan2(dy,dx);
    }
    player.x=clamp(player.x, player.r, W-player.r);
    player.y=clamp(player.y, player.r, H-player.r);

    // wave spawning
    if(state.waveSpawned < state.waveTotal){
      state.waveCooldown-=dt;
      if(state.waveCooldown<=0){
        spawnEnemy();
        state.waveCooldown = Math.max(0.22, 0.9 - state.wave*0.04);
      }
    } else {
      // check wave clear
      if(state.enemies.length===0){
        // bonus
        state.score+=50;
        state.wave++;
        beep(520,0.12,0.15,'sine'); setTimeout(()=>beep(780,0.12,0.15,'sine'),120);
        nextWaveSetup();
        if(opts.onWave) opts.onWave(state.wave);
      }
    }

    // enemies update
    for(const en of state.enemies){
      // knock decay
      en.knockX *= Math.pow(0.12, dt*60/60); // cheap lerp
      en.knockY *= Math.pow(0.12, dt*60/60);
      // approach player
      let dx = player.x - en.x;
      let dy = player.y - en.y;
      let d = Math.hypot(dx,dy);
      if(d>1){
        dx/=d; dy/=d;
        // separation
        for(const other of state.enemies){
          if(other===en) continue;
          const od = Math.hypot(other.x-en.x, other.y-en.y);
          if(od < en.radius+other.radius+4 && od>0.1){
            const sx = (en.x-other.x)/od;
            const sy = (en.y-other.y)/od;
            dx += sx*0.5; dy += sy*0.5;
          }
        }
        const nd = Math.hypot(dx,dy);
        if(nd>0){ dx/=nd; dy/=nd; }
        const spd = en.speed * (en.hitFlash>0 ? 0.35 : 1);
        en.x += dx*spd*dt + en.knockX*dt;
        en.y += dy*spd*dt + en.knockY*dt;
      }
      en.x=clamp(en.x, en.radius, W-en.radius);
      en.y=clamp(en.y, en.radius, H-en.radius);
      if(en.hitFlash>0) en.hitFlash-=dt;

      // damage player on contact (except during attack active we already hit)
      const pd = Math.hypot(en.x-player.x, en.y-player.y);
      if(pd < en.radius + player.r -1){
        takeDamage();
      }
    }

    // particles
    for(const p of state.particles){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=320*dt; p.vx*=0.98; p.life-=dt;
    }
    state.particles = state.particles.filter(p=>p.life>0);
    for(const t of state.damageTexts){ t.y+=t.vy*dt; t.life-=dt; }
    state.damageTexts = state.damageTexts.filter(t=>t.life>0);

    if(opts.onHUD) opts.onHUD(getHUD());
  }

  function draw(){
    // clear
    ctx.clearRect(0,0,W,H);
    // arena floor with subtle vignette
    // grid already via CSS, but draw darker border
    ctx.save();
    ctx.strokeStyle='rgba(42,58,94,0.9)';
    ctx.lineWidth=2;
    ctx.strokeRect(1,1,W-2,H-2);
    ctx.restore();

    // particles behind
    for(const p of state.particles){
      ctx.globalAlpha=Math.max(0,p.life/0.5);
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    // enemies
    for(const en of state.enemies){
      ctx.save();
      if(en.hitFlash>0){
        ctx.shadowColor='#fff'; ctx.shadowBlur=12;
      }
      // shadow
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(en.x, en.y+en.radius-2, en.radius*0.9, en.radius*0.45,0,0,Math.PI*2); ctx.fill();
      // body
      ctx.fillStyle=en.color;
      ctx.beginPath(); ctx.arc(en.x,en.y,en.radius,0,Math.PI*2); ctx.fill();
      // inner
      ctx.fillStyle='rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(en.x,en.y,en.radius*0.55,0,Math.PI*2); ctx.fill();
      // eyes toward player
      const ang = Math.atan2(player.y-en.y, player.x-en.x);
      ctx.fillStyle='#0a0e1a';
      for(let s=-1;s<=1;s+=2){
        const ex = en.x + Math.cos(ang)*4 + s*3;
        const ey = en.y + Math.sin(ang)*4 -2;
        ctx.beginPath(); ctx.arc(ex,ey,2.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.arc(ex+0.7,ey-0.7,0.9,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#0a0e1a';
      }
      // hp pips
      if(en.maxHp>1){
        ctx.fillStyle='rgba(255,255,255,0.9)';
        for(let i=0;i<en.maxHp;i++){
          ctx.globalAlpha = i<en.hp ? 1 : 0.2;
          ctx.fillRect(en.x - (en.maxHp*6)/2 + i*6, en.y - en.radius -7, 4,4);
        }
        ctx.globalAlpha=1;
      }
      ctx.restore();
    }

    // player
    ctx.save();
    // invuln flash
    if(state.invuln>0 && Math.floor(state.invuln*14)%2===0){
      ctx.globalAlpha=0.45;
    }
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y+player.r-1, player.r*0.95, player.r*0.5,0,0,Math.PI*2); ctx.fill();
    // body
    const grad = ctx.createRadialGradient(player.x-4,player.y-4,4,player.x,player.y,player.r);
    grad.addColorStop(0,'#a5f3fc'); grad.addColorStop(1,'#0ea5e9');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
    // ring
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.stroke();
    // direction indicator
    ctx.strokeStyle='#fff'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(state.facing)* (player.r-2), player.y + Math.sin(state.facing)*(player.r-2));
    ctx.lineTo(player.x + Math.cos(state.facing)* (player.r+8), player.y + Math.sin(state.facing)*(player.r+8));
    ctx.stroke();
    // slash arc
    if(state.attackActive>0){
      const prog = 1 - state.attackActive/0.15;
      const range=68;
      ctx.fillStyle=`rgba(74,222,128,${0.32 - prog*0.2})`;
      ctx.strokeStyle=`rgba(74,222,128,${0.9 - prog*0.5})`;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(player.x,player.y);
      ctx.arc(player.x,player.y,range, state.facing - Math.PI*0.33, state.facing + Math.PI*0.33);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // trail
      ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(player.x,player.y,range-10, state.facing - Math.PI*0.33 + prog*0.2, state.facing + Math.PI*0.33 - prog*0.2);
      ctx.stroke();
    }
    ctx.restore();

    // damage texts
    ctx.font='800 14px monospace';
    ctx.textAlign='center';
    for(const t of state.damageTexts){
      ctx.globalAlpha=Math.max(0,t.life/0.6);
      ctx.fillStyle='#f43f5e';
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha=1;

    // top wave text when spawning
    if(state.playing && state.enemies.length>0){
      ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.font='900 64px monospace'; ctx.textAlign='center';
      ctx.fillText(`WAVE ${state.wave}`, W/2, 52);
    }
  }

  function getHUD(){
    const remaining = (state.waveTotal - state.waveSpawned) + state.enemies.length;
    const waveProgress = state.waveTotal ? state.waveSpawned / state.waveTotal : 0;
    return {
      score:state.score, wave:state.wave, kills:state.kills, time:state.time,
      hp:state.hp, maxHp:state.maxHp, alive:state.enemies.length, remaining,
      waveProgress
    };
  }

  let last=0, raf=0;
  function loop(t){
    raf=requestAnimationFrame(loop);
    if(!last) last=t;
    const dt=Math.min(0.033, (t-last)/1000);
    last=t;
    update(dt);
    draw();
  }
  raf=requestAnimationFrame(loop);

  function start(){
    state.score=0; state.wave=1; state.kills=0; state.time=0;
    state.enemies=[]; state.particles=[]; state.damageTexts=[];
    resetPlayer();
    nextWaveSetup();
    state.attackCooldown=0; state.attackActive=0;
    state.playing=true; state.paused=false;
    last=0;
    beep(440,0.08,0.12,'sine');
  }
  function restart(){ start(); }
  function togglePause(force){
    if(!state.playing && force!==false) return false;
    if(typeof force==='boolean') state.paused=force;
    else state.paused=!state.paused;
    return state.paused;
  }
  function toggleMute(){
    muted=!muted; return muted;
  }

  // expose
  return {
    get state(){ return state.playing? (state.paused?'paused':'playing') : (state.hp<=0 && state.time>0 ? 'gameOver':'idle'); },
    keys: state.keys,
    attack, start, restart, togglePause, toggleMute,
    getHUD, get player(){return player}, get enemies(){return state.enemies},
    _state:state // for tests
  };
}

// pure helpers for tests
export function isInAttackCone(px,py,facing, ex,ey, range, coneRad){
  const dx=ex-px, dy=ey-py;
  const d=Math.hypot(dx,dy);
  if(d>range) return false;
  if(d<34) return true;
  const ang=Math.atan2(dy,dx);
  let diff=ang-facing; diff=Math.atan2(Math.sin(diff),Math.cos(diff));
  return Math.abs(diff) < coneRad/2;
}
export function waveEnemyCount(wave){ return Math.min(18, 3+wave*2); }
export function clamp(v,a,b){ return Math.max(a,Math.min(b,a))===a ? Math.max(a,Math.min(b,v)) : Math.max(a,Math.min(b,v)); }
