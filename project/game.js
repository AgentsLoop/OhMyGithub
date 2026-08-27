// NEXUS COMMAND - StarCraft-like RTS - vanilla JS
const TILE=32, MAP_W=48, MAP_H=48, WORLD_W=MAP_W*TILE, WORLD_H=MAP_H*TILE;
const PLAYER=0, ENEMY=1;
const canvas=document.getElementById('gameCanvas'), ctx=canvas.getContext('2d');
const minimap=document.getElementById('minimap'), mctx=minimap.getContext('2d');

let camera={x:0,y:0,w:canvas.width,h:canvas.height};
let gameTime=0, minerals=50, gas=0, supplyUsed=0, supplyCap=10, paused=false, gameOver=false;
let selected=[], buildings=[], units=[], resources=[], projectiles=[], effects=[], decorations=[];
let buildMode=null, buildGhost=null, attackMode=false, frameCount=0, lastTime=0;
let dragStart=null, dragEnd=null, isDragging=false;
let keys={};
let startTime=Date.now();
let controlGroups=Array(10).fill(null).map(()=>[]);

// Specs
const BUILDING_SPEC={
  cc:{name:'Command Center',w:4,h:3,hp:800,costM:0,costG:0,time:0,supply:0,provides:10,size:'large',color:'#3b82f6',produces:['scv']},
  depot:{name:'Supply Depot',w:2,h:2,hp:400,costM:100,costG:0,time:6,supply:0,provides:8,color:'#60a5fa',produces:[]},
  barracks:{name:'Barracks',w:3,h:3,hp:600,costM:150,costG:0,time:10,supply:0,provides:0,color:'#93c5fd',produces:['marine','tank']},
  refinery:{name:'Refinery',w:2,h:2,hp:350,costM:75,costG:0,time:6,supply:0,provides:0,color:'#22c55e',produces:[]},
};
const UNIT_SPEC={
  scv:{name:'SCV',hp:45,dmg:5,range:18,speed:2.2,cooldown:28,costM:50,costG:0,supply:1,time:5,size:10,color:'#60a5fa',isWorker:true},
  marine:{name:'Marine',hp:40,dmg:6,range:90,speed:1.9,cooldown:18,costM:50,costG:0,supply:1,time:4,size:11,color:'#38bdf8',isWorker:false},
  tank:{name:'Tank',hp:120,dmg:22,range:130,speed:1.1,cooldown:45,costM:150,costG:50,supply:3,time:8,size:15,color:'#fbbf24',isWorker:false},
  zergling:{name:'Zergling',hp:35,dmg:7,range:16,speed:2.6,cooldown:16,costM:25,costG:0,supply:1,time:3,size:10,color:'#ef4444',isWorker:false},
  drone:{name:'Drone',hp:40,dmg:4,range:16,speed:2.1,cooldown:25,costM:50,costG:0,supply:1,time:5,size:10,color:'#f87171',isWorker:true},
};

let idCounter=1;
const uid=()=>idCounter++;
function dist(a,b){let dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function worldToTile(x){return Math.floor(x/TILE)}
function tileToWorld(t){return t*TILE}

// Map: fog and terrain
let fog=[], explored=[], terrain=[];
function initMap(){
  for(let y=0;y<MAP_H;y++){
    terrain[y]=[]; fog[y]=[]; explored[y]=[];
    for(let x=0;x<MAP_W;x++){
      // terrain type 0=dirt 1=rock 2=void
      let n=Math.random();
      terrain[y][x]= n<0.02?1:0;
      fog[y][x]=1;
      explored[y][x]=0;
    }
  }
  // clear base areas
  function clearArea(tx,ty,rx,ry){
    for(let y=ty-ry;y<ty+ry;y++) for(let x=tx-rx;x<tx+rx;x++) if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H) terrain[y][x]=0;
  }
  clearArea(6,40,7,7); // player
  clearArea(41,8,7,7); // enemy
  // decorations
  decorations=[];
  for(let i=0;i<60;i++) decorations.push({x:Math.random()*WORLD_W,y:Math.random()*WORLD_H,r:2+Math.random()*3,alpha:0.15+Math.random()*0.2})
}

function addResource(type,x,y,amount){
  resources.push({id:uid(),type,x,y,amount,maxAmount:amount,harvested:0})
}

function initResources(){
  // player minerals
  const pMins=[[4,36],[7,36],[4,39],[7,39],[2,37],[9,38]];
  pMins.forEach(p=>addResource('mineral', tileToWorld(p[0])+16, tileToWorld(p[1])+16, 1500));
  addResource('gas', tileToWorld(5)+16, tileToWorld(34)+16, 2000);
  addResource('gas', tileToWorld(9)+16, tileToWorld(34)+16, 2000);
  // enemy minerals
  const eMins=[[43,6],[40,6],[43,9],[40,9],[45,7],[39,8]];
  eMins.forEach(p=>addResource('mineral', tileToWorld(p[0])+16, tileToWorld(p[1])+16, 1500));
  addResource('gas', tileToWorld(42)+16, tileToWorld(11)+16, 2000);
  // neutral minerals mid
  const mids=[[22,22],[24,24],[20,26],[28,20],[26,28],[18,18]];
  mids.forEach(p=>addResource('mineral', tileToWorld(p[0])+16, tileToWorld(p[1])+16, 1500));
  addResource('gas', tileToWorld(23)+16, tileToWorld(21)+16, 2000);
  // random extra
  for(let i=0;i<4;i++){
    let rx=12+Math.floor(Math.random()*24), ry=12+Math.floor(Math.random()*24);
    if(terrain[ry][rx]===0) addResource('mineral', tileToWorld(rx)+16, tileToWorld(ry)+16, 1000);
  }
}

function createBuilding(type,tx,ty,owner, instant=false){
  let spec=BUILDING_SPEC[type];
  let b={id:uid(),type,x:tx*TILE,y:ty*TILE,w:spec.w*TILE,h:spec.h*TILE,tx,ty,hp:instant?spec.hp:1,maxHp:spec.hp,owner,progress:instant?1:0,building:!instant,queue:[],producing:null,prodTimer:0,rally:{x:tx*TILE+spec.w*TILE+40,y:ty*TILE+spec.h*TILE/2},supplyProvided:spec.provides};
  buildings.push(b);
  if(instant && owner===PLAYER) supplyCap+=spec.provides;
  return b;
}
function createUnit(type,x,y,owner){
  let s=UNIT_SPEC[type];
  let u={id:uid(),type,x,y,hp:s.hp,maxHp:s.hp,owner,target:null,path:[],state:'idle',cooldown:0,carry:0,carryType:null,gatherTarget:null,buildTarget:null,attackTarget:null,hold:false,dest:null};
  units.push(u);
  if(owner===PLAYER) supplyUsed+=s.supply;
  return u;
}

function initGame(){
  // preserve array references for window._game
  buildings.length=0; units.length=0; resources.length=0; projectiles.length=0; effects.length=0;
  initMap();
  initResources();
  controlGroups=Array(10).fill(null).map(()=>[]);
  minerals=50; gas=0; supplyUsed=0; supplyCap=0; gameTime=0; gameOver=false;
  // Player base
  createBuilding('cc',5,38,PLAYER,true);
  createBuilding('depot',9,41,PLAYER,true);
  createBuilding('barracks',9,38,PLAYER,true);
  for(let i=0;i<4;i++) createUnit('scv', 5*TILE+40 + (i%2)*24, 38*TILE+ 50 + Math.floor(i/2)*22, PLAYER);
  createUnit('marine', 10*TILE, 37*TILE, PLAYER);
  // Enemy base
  createBuilding('cc',40,6,ENEMY,true);
  createBuilding('barracks',40,10,ENEMY,true);
  createBuilding('depot',44,9,ENEMY,true);
  for(let i=0;i<4;i++) createUnit('drone', 40*TILE+20+(i%2)*20, 6*TILE+60+Math.floor(i/2)*18, ENEMY);
  for(let i=0;i<2;i++) createUnit('zergling', 42*TILE+Math.random()*60, 10*TILE+40+Math.random()*40, ENEMY);
  camera.x = 2*TILE; camera.y = WORLD_H - canvas.height - 2*TILE;
  selected=[units[0]];
  log('Mission started. SCVs to minerals — build to grow.');
  // reveal starting area
  updateFog();
}

function log(msg){
  let el=document.getElementById('statusLog');
  let d=document.createElement('div'); d.textContent='['+formatTime(gameTime)+'] '+msg;
  el.prepend(d);
  while(el.children.length>6) el.removeChild(el.lastChild);
}
function formatTime(t){let s=Math.floor(t), m=Math.floor(s/60); s%=60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}

// --- INPUT ---
let mouse={x:0,y:0,wx:0,wy:0};
canvas.addEventListener('mousemove', e=>{
  let rect=canvas.getBoundingClientRect();
  let sx=(e.clientX-rect.left)*(canvas.width/rect.width);
  let sy=(e.clientY-rect.top)*(canvas.height/rect.height);
  mouse.x=sx; mouse.y=sy;
  mouse.wx=camera.x+sx; mouse.wy=camera.y+sy;
  if(isDragging && dragStart){
    dragEnd={x:sx,y:sy};
  }
  if(buildMode){
    let tx=worldToTile(mouse.wx - BUILDING_SPEC[buildMode].w*TILE/2);
    let ty=worldToTile(mouse.wy - BUILDING_SPEC[buildMode].h*TILE/2);
    tx=clamp(tx,0,MAP_W-BUILDING_SPEC[buildMode].w); ty=clamp(ty,0,MAP_H-BUILDING_SPEC[buildMode].h);
    buildGhost={tx,ty,type:buildMode,valid:canPlace(tx,ty,BUILDING_SPEC[buildMode].w,BUILDING_SPEC[buildMode].h)};
  }
  // edge pan
  if(sx<16) keys['panLeft']=true; else keys['panLeft']=false;
});

canvas.addEventListener('mousedown', e=>{
  let rect=canvas.getBoundingClientRect();
  let sx=(e.clientX-rect.left)*(canvas.width/rect.width);
  let sy=(e.clientY-rect.top)*(canvas.height/rect.height);
  let wx=camera.x+sx, wy=camera.y+sy;
  if(buildMode){
    if(e.button===0){
      if(buildGhost && buildGhost.valid) tryPlaceBuilding(buildGhost.tx,buildGhost.ty,buildMode);
      else log('Cannot build there.');
    } else if(e.button===2){ buildMode=null; buildGhost=null; updateBuildButtons(); }
    return;
  }
  if(e.button===0){
    // left
    if(attackMode){
      doAttackMove(wx,wy);
      attackMode=false; canvas.style.cursor='crosshair';
      return;
    }
    dragStart={x:sx,y:sy,wx,wy}; dragEnd={x:sx,y:sy}; isDragging=true;
  } else if(e.button===2){
    // right
    e.preventDefault();
    handleRightClick(wx,wy,e.shiftKey);
  }
});

canvas.addEventListener('mouseup', e=>{
  if(e.button!==0) return;
  if(!isDragging) return;
  isDragging=false;
  let rect=canvas.getBoundingClientRect();
  let sx=(e.clientX-rect.left)*(canvas.width/rect.width);
  let sy=(e.clientY-rect.top)*(canvas.height/rect.height);
  let wx=camera.x+sx, wy=camera.y+sy;
  if(buildMode) return;
  let x1=Math.min(dragStart.x, sx), y1=Math.min(dragStart.y, sy), x2=Math.max(dragStart.x,sx), y2=Math.max(dragStart.y,sy);
  let dragDist=Math.hypot(x2-x1,y2-y1);
  if(dragDist<6){
    // single select
    let hit=getEntityAt(wx,wy);
    if(hit){
      if(e.ctrlKey || e.metaKey){
        let idx=selected.indexOf(hit);
        if(idx>=0) selected.splice(idx,1); else selected.push(hit);
      } else if(e.shiftKey){
        if(!selected.includes(hit)) selected.push(hit);
      } else selected=[hit];
    } else {
      if(!e.shiftKey) selected=[];
    }
  } else {
    // box select
    let w1=camera.x+x1, h1=camera.y+y1, w2=camera.x+x2, h2=camera.y+y2;
    let boxUnits=units.filter(u=>u.owner===PLAYER && u.x>=w1 && u.x<=w2 && u.y>=h1 && u.y<=h2);
    let boxBuildings=buildings.filter(b=>b.owner===PLAYER && b.x+b.w>=w1 && b.x<=w2 && b.y+b.h>=h1 && b.y<=h2);
    let hits=[...boxUnits,...boxBuildings];
    if(hits.length){
      if(e.shiftKey) hits.forEach(h=>{if(!selected.includes(h)) selected.push(h)});
      else selected=hits;
    } else if(!e.shiftKey) selected=[];
  }
  dragStart=null; dragEnd=null;
  updateSelectionUI();
});

canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('wheel', e=>{
  // optional zoom not implemented, use as pan speed? ignore
  e.preventDefault();
},{passive:false});

function getEntityAt(wx,wy){
  // units first
  for(let i=units.length-1;i>=0;i--){let u=units[i]; let s=UNIT_SPEC[u.type]; let r=s.size+6; if(Math.hypot(u.x-wx,u.y-wy)<r) return u}
  for(let b of buildings){ if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h) return b}
  for(let r of resources){ if(Math.hypot(r.x-wx,r.y-wy)<20) return r}
  return null;
}

function handleRightClick(wx,wy,shift){
  if(!selected.length) return;
  let targetUnit=units.find(u=>Math.hypot(u.x-wx,u.y-wy)<14 && u.owner!==PLAYER);
  let targetBuilding=buildings.find(b=>wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h && b.owner!==PLAYER);
  let res=resources.find(r=>Math.hypot(r.x-wx,r.y-wy)<22);
  let buildingTarget=buildings.find(b=>wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h && b.owner===PLAYER);

  selected.forEach(ent=>{
    if(ent.hp===undefined) return;
    // if building selected, set rally
    if(ent.w!==undefined){ // building
      ent.rally={x:wx,y:wy};
      spawnEffect(wx,wy,'rally');
      return;
    }
    // unit
    let u=ent;
    if(!shift){ u.path=[]; u.target=null; u.state='idle'; u.gatherTarget=null; u.buildTarget=null; u.attackTarget=null; }
    if(targetUnit){
      u.attackTarget=targetUnit; u.state='attack'; u.dest={x:targetUnit.x,y:targetUnit.y}; addMoveEffect(targetUnit.x,targetUnit.y,true);
    } else if(targetBuilding){
      u.attackTarget=targetBuilding; u.state='attack'; u.dest={x:targetBuilding.x+targetBuilding.w/2,y:targetBuilding.y+targetBuilding.h/2}; addMoveEffect(u.dest.x,u.dest.y,true);
    } else if(res && UNIT_SPEC[u.type].isWorker){
      u.gatherTarget=res; u.state='gather'; u.dest={x:res.x,y:res.y}; u.carryType=null;
      addMoveEffect(res.x,res.y,false);
    } else if(buildingTarget && u.carry===0){
      // repair? ignore
      u.dest={x:wx,y:wy}; u.state='move'; addMoveEffect(wx,wy,false);
    } else {
      u.dest={x:wx,y:wy}; u.state='move'; u.attackTarget=null;
      if(shift) u.path.push({x:wx,y:wy}); else u.path=[{x:wx,y:wy}];
      addMoveEffect(wx,wy,false);
    }
  });
}

function doAttackMove(wx,wy){
  selected.forEach(u=>{
    if(u.w!==undefined) return;
    u.state='attackmove'; u.dest={x:wx,y:wy}; u.path=[{x:wx,y:wy}]; u.attackTarget=null;
    addMoveEffect(wx,wy,true);
  });
}
function addMoveEffect(x,y,isAttack){
  effects.push({x,y,t:0,maxT:18,type:'move',isAttack});
}
function spawnEffect(x,y,type){
  effects.push({x,y,t:0,maxT:24,type});
}

// keyboard
window.addEventListener('keydown', e=>{
  let k=e.key.toLowerCase();
  keys[k]=true;
  // Control Groups: Ctrl+0..9 assign, 0..9 recall (Brood War style)
  if(k>='0' && k<='9'){
    let num=parseInt(k);
    if((e.ctrlKey||e.metaKey) && e.shiftKey){
      e.preventDefault();
      let existing=controlGroups[num]||[];
      let add=[...selected].filter(ent=>!existing.includes(ent));
      controlGroups[num]=[...existing, ...add];
      log('Group '+num+' added +'+add.length+' (now '+controlGroups[num].length+') — Ctrl+Shift+'+num);
      updateControlGroupsUI();
      updateSelectionUI();
      return;
    }
    if(e.ctrlKey || e.metaKey){
      e.preventDefault();
      if(selected.length){
        controlGroups[num]=[...selected];
        log('Group '+num+' assigned ('+selected.length+') — Ctrl+'+num);
        updateControlGroupsUI();
      } else {
        controlGroups[num]=[];
        log('Group '+num+' cleared');
        updateControlGroupsUI();
      }
      updateSelectionUI();
      return;
    } else if(!e.altKey && !e.shiftKey && !buildMode){
      // recall group if exists, otherwise fallback to legacy quick-select for 1-3
      if(controlGroups[num] && controlGroups[num].length){
        e.preventDefault();
        let alive=controlGroups[num].filter(ent=> ent.hp>0 && (units.includes(ent) || buildings.includes(ent)));
        controlGroups[num]=alive;
        if(alive.length){
          if(e.shiftKey){ // note shift already handled but keep add behavior with Ctrl recall? plain shift not here
          }
          selected=[...alive];
          // double-tap center camera
          let now=Date.now();
          if(window._lastGroupTap && window._lastGroupTap.num===num && now - window._lastGroupTap.t < 400){
            let cx=alive.reduce((s,u)=>s+u.x,0)/alive.length;
            let cy=alive.reduce((s,u)=>s+u.y,0)/alive.length;
            camera.x=clamp(cx - canvas.width/2,0,WORLD_W-canvas.width);
            camera.y=clamp(cy - canvas.height/2,0,WORLD_H-canvas.height);
          }
          window._lastGroupTap={num, t:now};
          // if Shift held, add to selection instead of replace
          if(e.shiftKey){
            // actually shift already prevented recall, so this branch not hit; keep for Ctrl+Shift add
          }
          log('Group '+num+' recalled ('+alive.length+')');
          updateControlGroupsUI();
          updateSelectionUI();
        } else {
          log('Group '+num+' empty');
        }
        return;
      } else {
        // legacy quick-select fallback for 1-3 when no group assigned
        if(k==='1'){ let scvs=units.filter(u=>u.owner===PLAYER && u.type==='scv'); if(scvs.length){ selected=scvs.slice(0,8); updateSelectionUI(); return; } }
        if(k==='2'){ let m=units.filter(u=>u.owner===PLAYER && u.type==='marine'); if(m.length){ selected=m.slice(0,12); updateSelectionUI(); return; } }
        if(k==='3'){ let t=units.filter(u=>u.owner===PLAYER && u.type==='tank'); if(t.length){ selected=t; updateSelectionUI(); return; } }
      }
    }
  }

  if(k==='a' && !buildMode){ attackMode=!attackMode; canvas.style.cursor=attackMode?'crosshair':'crosshair'; log(attackMode?'Attack mode — click to attack-move':'Attack mode off');}
  if(k==='s'){ selected.forEach(u=>{if(u.w===undefined){u.state='idle';u.path=[];u.dest=null;u.attackTarget=null}}); log('Stop.') }
  if(k==='h'){ selected.forEach(u=>{if(u.w===undefined){u.hold=true;u.state='hold'}})}
  if(k==='escape'){ buildMode=null;buildGhost=null;attackMode=false;updateBuildButtons()}
  if(k==='b'){ if(selected.some(s=>s.type==='scv' && s.owner===PLAYER)) showBuildMenuQuick() }
  if(k==='f'){ // toggle fog for debug? ignore
  }
  // building hotkeys when SCV selected + build mode ghost
  if(buildMode){
    if(k==='c'){} // etc
  }
});
window.addEventListener('keyup', e=>{keys[e.key.toLowerCase()]=false});

function canPlace(tx,ty,w,h){
  // check terrain, buildings, resources
  for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++){
    let x=tx+dx,y=ty+dy;
    if(x<0||y<0||x>=MAP_W||y>=MAP_H) return false;
    if(terrain[y][x]===1) return false;
  }
  let px=tx*TILE, py=ty*TILE, pw=w*TILE, ph=h*TILE;
  for(let b of buildings) if(rectOverlap(px,py,pw,ph,b.x,b.y,b.w,b.h)) return false;
  for(let r of resources) if(rectOverlap(px,py,pw,ph,r.x-16,r.y-16,32,32)) return false;
  return true;
}
function rectOverlap(x1,y1,w1,h1,x2,y2,w2,h2){return x1 < x2+w2 && x1+w1 > x2 && y1 < y2+h2 && y1+h1 > y2}

function tryPlaceBuilding(tx,ty,type){
  let spec=BUILDING_SPEC[type];
  if(minerals<spec.costM || gas<spec.costG){ log('Not enough resources'); return;}
  if(supplyUsed>supplyCap) {} // building supply not blocked
  let b=createBuilding(type,tx,ty,PLAYER,false);
  b.progress=0; b.buildTime=spec.time;
  minerals-=spec.costM; gas-=spec.costG;
  log('SCV constructing '+spec.name);
  // assign nearest SCV to build
  let scv=selected.find(u=>u.type==='scv' && u.owner===PLAYER);
  if(!scv) scv=units.filter(u=>u.owner===PLAYER && u.type==='scv').sort((a,b)=>dist(a,b)-dist({x:b.x,y:b.y}))[0];
  if(scv){
    scv.buildTarget=b; scv.state='build'; scv.dest={x:b.x+b.w/2,y:b.y+b.h/2};
  }
  buildMode=null; buildGhost=null; updateBuildButtons();
}

function showBuildMenuQuick(){
  // quick cycle build mode to cc? Better open menu
  document.getElementById('buildMenu').classList.remove('hidden');
  renderBuildMenu();
}
function renderBuildMenu(){
  let grid=document.getElementById('buildMenuGrid'); grid.innerHTML='';
  Object.entries(BUILDING_SPEC).forEach(([key,spec])=>{
    let btn=document.createElement('button'); btn.className='buildBtn';
    btn.innerHTML=`<span class="bIcon">${key==='cc'?'🏢':key==='depot'?'📦':key==='barracks'?'🏭':'⛽'}</span><span class="bName">${spec.name}</span><span class="bCost">${spec.costM}M ${spec.costG?spec.costG+'G':''} — ${spec.provides?' +'+spec.provides+' supply':''}</span>`;
    btn.onclick=()=>{ buildMode=key; document.getElementById('buildMenu').classList.add('hidden'); updateBuildButtons(); };
    if(minerals<spec.costM||gas<spec.costG) btn.disabled=true;
    grid.appendChild(btn);
  });
}
document.getElementById('buildMenuClose').onclick=()=>document.getElementById('buildMenu').classList.add('hidden');

// --- GAME LOGIC ---
function update(dt){
  if(paused||gameOver) return;
  gameTime+=dt;
  // update buildings construction and production
  for(let b of buildings){
    if(b.building){
      b.progress+=dt / b.buildTime;
      if(b.progress>=1){ b.building=false; b.progress=1; b.hp=b.maxHp; if(b.supplyProvided && b.owner===PLAYER) supplyCap+=b.supplyProvided; log(b.type+' complete'); spawnEffect(b.x+b.w/2,b.y+b.h/2,'buildDone');
        // release builder?
        units.forEach(u=>{if(u.buildTarget===b){u.buildTarget=null;u.state='idle'}})
      } else {
        b.hp=1+Math.floor(b.maxHp*b.progress*0.9);
      }
    } else {
      if(b.queue.length || b.producing){
        if(!b.producing && b.queue.length){
          b.producing=b.queue.shift(); b.prodTimer=UNIT_SPEC[b.producing].time;
        }
        if(b.producing){
          b.prodTimer-=dt;
          if(b.prodTimer<=0){
            let type=b.producing;
            let sx=b.x+b.w+14, sy=b.y+b.h/2 + (Math.random()*20-10);
            // avoid overlap
            let tries=0; while(buildings.some(bb=>rectOverlap(sx-10,sy-10,20,20,bb.x,bb.y,bb.w,bb.h)) && tries<10){ sx+=20; tries++}
            let u=createUnit(type,sx,sy,b.owner);
            // rally
            u.dest={x:b.rally.x,y:b.rally.y}; u.state='move'; u.path=[{x:b.rally.x,y:b.rally.y}];
            b.producing=null;
            if(b.owner===PLAYER) log(type+' ready');
          }
        }
      }
    }
  }
  // units
  for(let u of units){
    if(u.cooldown>0) u.cooldown-=dt*60; // frames
    let spec=UNIT_SPEC[u.type];
    // find closest enemy if in attackmove or hold
    if(u.state==='attackmove' || u.state==='hold'){
      let enemies=[...units.filter(o=>o.owner!==u.owner), ...buildings.filter(o=>o.owner!==u.owner && !o.building)];
      let nearest=null, nd=spec.range*1.8;
      for(let e of enemies){ let d=dist(u,e); if(d<nd && hasLineOfSight(u,e)){ nearest=e; nd=d } }
      if(nearest){ u.attackTarget=nearest; u.state='attack'; }
      else if(u.state==='attackmove' && u.dest){
        moveToward(u, u.dest.x, u.dest.y, spec);
        if(dist(u,u.dest)<10){ u.state='idle'; u.dest=null; u.path=[]; }
      }
    } else if(u.state==='move'){
      if(u.dest){ moveToward(u,u.dest.x,u.dest.y,spec); if(dist(u,u.dest)<8){ if(u.path.length>1){u.path.shift();u.dest=u.path[0]} else {u.state='idle';u.dest=null;u.path=[]}} }
    } else if(u.state==='attack'){
      let t=u.attackTarget;
      // validate target alive
      if(!t || t.hp<=0 || (t.type && !units.includes(t) && !buildings.includes(t))){
        // find new nearby
        let cand=[...units,...buildings].filter(e=>e.owner!==u.owner && e.hp>0 && dist(u,e)<spec.range*1.5);
        if(cand.length) { t=cand.sort((a,b)=>dist(u,a)-dist(u,b))[0]; u.attackTarget=t; } else { u.state='idle'; u.attackTarget=null; continue;}
      }
      let d=dist(u,t);
      if(d>spec.range){
        moveToward(u, t.x, t.y, spec);
      } else {
        // attack
        if(u.cooldown<=0){
          doAttack(u,t);
          u.cooldown=spec.cooldown;
        }
      }
    } else if(u.state==='gather'){
      if(!u.gatherTarget || u.gatherTarget.amount<=0){
        // find nearest mineral
        let nearest=resources.filter(r=>r.amount>0).sort((a,b)=>dist(u,a)-dist(u,b))[0];
        if(nearest) u.gatherTarget=nearest; else {u.state='idle'; continue;}
      }
      let res=u.gatherTarget;
      if(u.carry>0){
        // return to CC
        let cc=buildings.filter(b=>b.owner===u.owner && b.type==='cc' && !b.building).sort((a,b)=>dist(u,a)-dist(u,b))[0];
        if(!cc){ u.state='idle'; continue; }
        let tx=cc.x+cc.w/2, ty=cc.y+cc.h/2;
        if(dist(u,{x:tx,y:ty})<40){
          // deposit
          if(u.owner===PLAYER){
            if(u.carryType==='mineral') minerals+=u.carry;
            else gas+=u.carry;
          }
          spawnEffect(tx,ty-30,'gather');
          u.carry=0; u.carryType=null;
        } else {
          moveToward(u,tx,ty,spec);
        }
      } else {
        if(dist(u,res)<22){
          // harvest
          u.carryType=res.type; // sit for time
          if(!u.harvestTimer) u.harvestTimer=0.9;
          u.harvestTimer-=dt;
          if(u.harvestTimer<=0){
            let amt=Math.min(8,res.amount);
            res.amount-=amt; res.harvested+=amt;
            u.carry=amt;
            u.harvestTimer=null;
            if(res.amount<=0) { resources.splice(resources.indexOf(res),1); }
          }
        } else {
          moveToward(u,res.x,res.y,spec);
        }
      }
    } else if(u.state==='build'){
      let b=u.buildTarget;
      if(!b || !b.building){ u.state='idle'; u.buildTarget=null; continue; }
      let tx=b.x+b.w/2, ty=b.y+b.h/2+ b.h/2+10;
      if(dist(u,{x:tx,y:ty})<38){
        // build
        b.progress+=dt*0.35; // scv build speed
        b.hp=Math.floor(b.maxHp*b.progress*0.9)+1;
        if(b.progress>=1){ b.building=false; b.progress=1; b.hp=b.maxHp; if(b.supplyProvided && b.owner===PLAYER) supplyCap+=b.supplyProvided; log(b.type+' finished'); u.state='idle'; u.buildTarget=null; spawnEffect(b.x+b.w/2,b.y+b.h/2,'buildDone'); }
      } else {
        moveToward(u,tx,ty,spec);
      }
    } else if(u.state==='idle'){
      // auto-acquire nearby enemy
      let enemies=[...units,...buildings].filter(e=>e.owner!==u.owner && e.hp>0 && dist(u,e)<110);
      if(enemies.length && !u.hold){
        let nearest=enemies.sort((a,b)=>dist(u,a)-dist(u,b))[0];
        if(dist(u,nearest)<100) { u.attackTarget=nearest; u.state='attack'; }
      }
    }
    // separation
    for(let o of units){ if(o===u) continue; let d=dist(u,o); let min= (UNIT_SPEC[u.type].size+UNIT_SPEC[o.type].size)/1.6; if(d<min && d>0){ let ang=Math.atan2(u.y-o.y,u.x-o.x); u.x+=Math.cos(ang)*0.6; u.y+=Math.sin(ang)*0.6; } }
    // clamp world
    u.x=clamp(u.x,10,WORLD_W-10); u.y=clamp(u.y,10,WORLD_H-10);
  }
  // projectiles
  for(let i=projectiles.length-1;i>=0;i--){
    let p=projectiles[i];
    p.x+=p.vx; p.y+=p.vy; p.life-=dt;
    if(p.life<=0 || dist(p,p.target)<10 || p.target.hp<=0){
      if(p.target.hp>0) doDamage(p.target,p.dmg,p.owner);
      spawnEffect(p.x,p.y,'hit');
      projectiles.splice(i,1);
    } else if(dist(p,p.target)<4){
      doDamage(p.target,p.dmg,p.owner);
      projectiles.splice(i,1);
    }
  }
  // effects
  for(let i=effects.length-1;i>=0;i--){ effects[i].t+=dt*60; if(effects[i].t>=effects[i].maxT) effects.splice(i,1); }
  // cleanup dead
  for(let i=units.length-1;i>=0;i--){
    if(units[i].hp<=0){
      let u=units[i];
      spawnEffect(u.x,u.y,'explode');
      if(u.owner===PLAYER) supplyUsed-=UNIT_SPEC[u.type].supply;
      if(supplyUsed<0) supplyUsed=0;
      // remove from selection
      let idx=selected.indexOf(u); if(idx>=0) selected.splice(idx,1);
      // remove from control groups
      for(let g=0;g<10;g++){ let gi=controlGroups[g].indexOf(u); if(gi>=0) controlGroups[g].splice(gi,1); }
      units.splice(i,1);
    }
  }
  for(let i=buildings.length-1;i>=0;i--){
    if(buildings[i].hp<=0){
      let b=buildings[i];
      spawnEffect(b.x+b.w/2,b.y+b.h/2,'explode');
      if(!b.building && b.supplyProvided && b.owner===PLAYER) supplyCap-=b.supplyProvided;
      if(selected.includes(b)) selected.splice(selected.indexOf(b),1);
      for(let g=0;g<10;g++){ let gi=controlGroups[g].indexOf(b); if(gi>=0) controlGroups[g].splice(gi,1); }
      buildings.splice(i,1);
    }
  }
  // keep control groups UI fresh
  if(frameCount%60===0) updateControlGroupsUI();
  // fog
  if(frameCount%10===0) updateFog();
  // AI
  if(frameCount%60===0) runAI();
  // check victory
  checkVictory();
  frameCount++;
}

function hasLineOfSight(a,b){ return true; }

function moveToward(u, tx, ty, spec){
  let dx=tx-u.x, dy=ty-u.y, d=Math.hypot(dx,dy);
  if(d<2) return;
  let nx=dx/d, ny=dy/d;
  // avoid buildings
  let avoidX=0, avoidY=0;
  for(let b of buildings){
    let cx=b.x+b.w/2, cy=b.y+b.h/2;
    let dd=Math.hypot(u.x-cx,u.y-cy);
    let rad=Math.max(b.w,b.h)/1.2+18;
    if(dd<rad){
      let ax=u.x-cx, ay=u.y-cy, ad=Math.hypot(ax,ay)||1;
      let push=(rad-dd)/rad*1.6;
      avoidX+=ax/ad*push; avoidY+=ay/ad*push;
    }
  }
  nx+=avoidX; ny+=avoidY;
  let nd=Math.hypot(nx,ny)||1; nx/=nd; ny/=nd;
  u.x+=nx*spec.speed; u.y+=ny*spec.speed;
}

function doAttack(attacker,target){
  let spec=UNIT_SPEC[attacker.type];
  if(spec.range>30){
    // projectile
    let ang=Math.atan2(target.y-attacker.y,target.x-attacker.x);
    let spd=9;
    projectiles.push({x:attacker.x,y:attacker.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,target,dmg:spec.dmg,owner:attacker.owner,life:60});
  } else {
    doDamage(target,spec.dmg,attacker.owner);
    spawnEffect(target.x+ (Math.random()*10-5),target.y+(Math.random()*10-5),'hit');
  }
}
function doDamage(target,dmg,owner){
  target.hp-=dmg;
  // flash handled in render via t
  target.lastHit=Date.now();
}

function updateFog(){
  // simple: visible radius around player units/buildings
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) fog[y][x]=1;
  let viewers=[...units.filter(u=>u.owner===PLAYER), ...buildings.filter(b=>b.owner===PLAYER)];
  for(let v of viewers){
    let tx=worldToTile(v.x), ty=worldToTile(v.y);
    let rad= v.w? 7:6;
    for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad;dx<=rad;dx++){
      let x=tx+dx,y=ty+dy; if(x<0||y<0||x>=MAP_W||y>=MAP_H) continue;
      if(dx*dx+dy*dy<=rad*rad){ fog[y][x]=0; explored[y][x]=1; }
    }
  }
  // enemy viewers for their own fog not needed; for player reveal we keep fog as above
}

let aiTimer=0, aiAttackCooldown=0;
function runAI(){
  // gather: assign drones to minerals
  let drones=units.filter(u=>u.owner===ENEMY && u.type==='drone');
  let enemyCC=buildings.find(b=>b.owner===ENEMY && b.type==='cc');
  if(!enemyCC) return;
  // ensure at least 4 drones gathering
  drones.forEach(d=>{
    if(d.state==='idle' && !d.gatherTarget){
      let near=resources.filter(r=>r.amount>0).sort((a,b)=>dist(d,a)-dist(d,b))[0];
      // prefer near enemy base
      let nearEnemyMin=resources.filter(r=>dist(r,enemyCC)<360 && r.amount>0).sort((a,b)=>dist(d,a)-dist(d,b))[0];
      if(nearEnemyMin) d.gatherTarget=nearEnemyMin; else if(near) d.gatherTarget=near;
      if(d.gatherTarget) d.state='gather';
    }
  });
  // produce drones
  aiTimer+=1;
  if(aiTimer%180===0){
    // supply check
    let eSupplyUsed=units.filter(u=>u.owner===ENEMY).reduce((s,u)=>s+UNIT_SPEC[u.type].supply,0);
    let eSupplyCap=buildings.filter(b=>b.owner===ENEMY).reduce((s,b)=>s+ (b.building?0:b.supplyProvided),0)+10;
    if(eSupplyUsed>=eSupplyCap-2){
      // build depot if can afford (simulate resources via time)
      let depotSpec=BUILDING_SPEC.depot;
      if(!buildings.some(b=>b.owner===ENEMY && b.building)){
        let tx=enemyCC.tx+ (Math.random()>0.5?5:-3), ty=enemyCC.ty+4;
        if(canPlace(tx,ty,depotSpec.w,depotSpec.h)){
          let b=createBuilding('depot',tx,ty,ENEMY,false); b.buildTime=5; // quick
          // assign drone
          let d=drones.find(x=>x.state!=='build'); if(d){d.buildTarget=b;d.state='build';d.dest={x:b.x+b.w/2,y:b.y+b.h/2}}
        }
      }
    }
    // produce units from barracks
    let barracks=buildings.filter(b=>b.owner===ENEMY && b.type==='barracks' && !b.building);
    barracks.forEach(br=>{
      if(!br.producing && br.queue.length<2){
        // choose zergling mostly, sometimes drone
        let choose = Math.random()<0.75?'zergling':'zergling';
        br.queue.push(choose);
      }
    });
    // build extra barracks occasionally
    if(barracks.length<2 && aiTimer>600 && Math.random()<0.015){
      let tx=enemyCC.tx+6, ty=enemyCC.ty+1;
      if(canPlace(tx,ty,BUILDING_SPEC.barracks.w,BUILDING_SPEC.barracks.h)){
        let b=createBuilding('barracks',tx,ty,ENEMY,false); b.buildTime=8;
        let d=drones.find(x=>x.state!=='build'); if(d){d.buildTarget=b;d.state='build'}
      }
    }
    // attack wave
    aiAttackCooldown--;
    if(aiAttackCooldown<=0){
      let fighters=units.filter(u=>u.owner===ENEMY && (u.type==='zergling'));
      if(fighters.length>=6){
        let target= buildings.find(b=>b.owner===PLAYER) || units.find(u=>u.owner===PLAYER);
        if(target){
          fighters.forEach(f=>{ f.attackTarget=target; f.state='attack'; f.dest={x:target.x,y:target.y}; f.path=[{x:target.x,y:target.y}] });
          aiAttackCooldown= 420+ Math.random()*300; // 7-12 sec
        }
      }
    }
  }
  // auto instant build progression for AI buildings (simulate SCV)
  buildings.filter(b=>b.owner===ENEMY && b.building).forEach(b=>{ b.progress+=0.015; if(b.progress>=1){b.building=false;b.progress=1;b.hp=b.maxHp; if(b.supplyProvided) {} }});
}

function checkVictory(){
  if(gameOver) return;
  let enemyAlive= buildings.some(b=>b.owner===ENEMY) || units.some(u=>u.owner===ENEMY);
  let playerAlive= buildings.some(b=>b.owner===PLAYER) || units.some(u=>u.owner===PLAYER);
  if(!enemyAlive){
    gameOver=true; showEnd(true);
  } else if(!playerAlive){
    gameOver=true; showEnd(false);
  }
}
function showEnd(victory){
  let el=document.getElementById('endScreen'); el.classList.remove('hidden');
  document.getElementById('endTitle').textContent=victory?'VICTORY':'DEFEAT';
  document.getElementById('endTitle').style.color=victory?'#22c55e':'#ef4444';
  document.getElementById('endDesc').textContent=victory? 'Hive cluster eliminated. Sector secured. Well done, Commander.' : 'Command Center lost. All forces eliminated.';
  document.getElementById('endScreen').style.display='flex';
}

// --- RENDER ---
function render(){
  // clear
  ctx.fillStyle='#020b18';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(-camera.x,-camera.y);

  // terrain tiles
  let startX=Math.floor(camera.x/TILE)-1, endX=Math.ceil((camera.x+canvas.width)/TILE)+1;
  let startY=Math.floor(camera.y/TILE)-1, endY=Math.ceil((camera.y+canvas.height)/TILE)+1;
  startX=clamp(startX,0,MAP_W-1); endX=clamp(endX,0,MAP_W-1); startY=clamp(startY,0,MAP_H-1); endY=clamp(endY,0,MAP_H-1);
  for(let y=startY;y<=endY;y++) for(let x=startX;x<=endX;x++){
    let wx=x*TILE, wy=y*TILE;
    // base dirt
    if(terrain[y][x]===1){
      ctx.fillStyle='#1a2740'; ctx.fillRect(wx,wy,TILE,TILE);
      ctx.fillStyle='#0f1f36'; ctx.fillRect(wx+4,wy+4,TILE-8,TILE-8);
    } else {
      // subtle pattern
      ctx.fillStyle= ((x+y)%2===0)?'#0a1830':'#0e1e38';
      ctx.fillRect(wx,wy,TILE,TILE);
      if(((x*13+y*7)%17)===0){ ctx.fillStyle='#ffffff06'; ctx.fillRect(wx+8,wy+8,6,6); }
    }
    // grid lines faint
    ctx.strokeStyle='#ffffff04'; ctx.strokeRect(wx,wy,TILE,TILE);
  }
  // decorations
  for(let d of decorations){
    if(d.x<camera.x-20||d.x>camera.x+canvas.width+20||d.y<camera.y-20||d.y>camera.y+canvas.height+20) continue;
    ctx.fillStyle=`rgba(110,140,190,${d.alpha})`; ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
  }
  // resources
  for(let r of resources){
    if(r.x<camera.x-40||r.x>camera.x+canvas.width+40||r.y<camera.y-40||r.y>camera.y+canvas.height+40) continue;
    if(r.type==='mineral'){
      ctx.fillStyle='#0ea5e9'; ctx.shadowColor='#38bdf8'; ctx.shadowBlur=10;
      ctx.fillRect(r.x-14,r.y-10,28,20);
      ctx.fillStyle='#e0f2fe'; ctx.fillRect(r.x-14,r.y-10,28,4);
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='8px Share Tech Mono'; ctx.fillText(Math.floor(r.amount),r.x-10,r.y+4);
      // shimmer
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(r.x-10,r.y-8,6,4);
    } else {
      ctx.fillStyle='#22c55e'; ctx.shadowColor='#4ade80'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(r.x,r.y,16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#052e16'; ctx.beginPath(); ctx.arc(r.x,r.y,8,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.fillStyle='#86efac'; ctx.font='7px Share Tech Mono'; ctx.fillText('GAS',r.x-10,r.y+3);
    }
    // amount bar
    let pct=r.amount/r.maxAmount;
    ctx.fillStyle='#111'; ctx.fillRect(r.x-14,r.y+12,28,4); ctx.fillStyle=r.type==='mineral'?'#38bdf8':'#22c55e'; ctx.fillRect(r.x-14,r.y+12,28*pct,4);
  }
  // buildings
  for(let b of buildings){
    let spec=BUILDING_SPEC[b.type];
    // shadow
    ctx.fillStyle='#0006'; ctx.fillRect(b.x+6,b.y+b.h-8,b.w-12,10);
    // body
    let col=b.owner===PLAYER?'#1e3a5a':'#431a1a';
    let col2=b.owner===PLAYER?'#2a4a6a':'#7f1d1d';
    ctx.fillStyle=b.building? '#1a2a3a' : col; ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle=b.owner===PLAYER?'#38bdf8':'#ef4444'; ctx.lineWidth=1.5; ctx.strokeRect(b.x,b.y,b.w,b.h);
    // inner detail
    ctx.fillStyle=col2; ctx.fillRect(b.x+4,b.y+4,b.w-8,b.h-12);
    // icon text
    ctx.fillStyle='#fff'; ctx.font='bold 10px Orbitron'; ctx.textAlign='center';
    let label= b.type==='cc'?'COMMAND':b.type==='barracks'?'BARRACKS':b.type==='depot'?'DEPOT':'REFINERY';
    ctx.fillText(label,b.x+b.w/2,b.y+20);
    if(b.building){
      ctx.fillStyle='#000a'; ctx.fillRect(b.x,b.y+b.h-16,b.w,16);
      ctx.fillStyle='#111'; ctx.fillRect(b.x+4,b.y+b.h-12,b.w-8,6);
      ctx.fillStyle='#22c55e'; ctx.fillRect(b.x+4,b.y+b.h-12,(b.w-8)*b.progress,6);
      ctx.fillStyle='#fff'; ctx.font='8px Share Tech Mono'; ctx.fillText(Math.floor(b.progress*100)+'%',b.x+b.w/2,b.y+b.h-3);
    } else {
      // hp bar
      let pct=b.hp/b.maxHp;
      ctx.fillStyle='#111'; ctx.fillRect(b.x,b.y-8,b.w,6); ctx.fillStyle=pct>0.5?'#22c55e':pct>0.25?'#f59e0b':'#ef4444'; ctx.fillRect(b.x,b.y-8,b.w*pct,6);
      ctx.fillStyle='#fff'; ctx.font='7px Share Tech Mono'; ctx.textAlign='center'; ctx.fillText(b.hp+'/'+b.maxHp,b.x+b.w/2,b.y-3);
      // production bar
      if(b.producing){
        let p=(UNIT_SPEC[b.producing].time - b.prodTimer)/UNIT_SPEC[b.producing].time;
        ctx.fillStyle='#000c'; ctx.fillRect(b.x,b.y+b.h+2,b.w,5); ctx.fillStyle='#06b6d4'; ctx.fillRect(b.x,b.y+b.h+2,b.w*p,5);
      }
      // rally line
      if(selected.includes(b)){
        ctx.strokeStyle='#06b6d466'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(b.x+b.w/2,b.y+b.h/2); ctx.lineTo(b.rally.x,b.rally.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#06b6d4'; ctx.beginPath(); ctx.arc(b.rally.x,b.rally.y,4,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.textAlign='left';
    // selection highlight
    if(selected.includes(b)){
      ctx.strokeStyle='#22d3ee'; ctx.lineWidth=1; ctx.setLineDash([6,3]); ctx.strokeRect(b.x-2,b.y-2,b.w+4,b.h+4); ctx.setLineDash([]);
    }
  }
  // build ghost
  if(buildGhost){
    let s=BUILDING_SPEC[buildGhost.type];
    let gx=buildGhost.tx*TILE, gy=buildGhost.ty*TILE;
    ctx.globalAlpha=0.55; ctx.fillStyle=buildGhost.valid?'#22c55e':'#ef4444'; ctx.fillRect(gx,gy,s.w*TILE,s.h*TILE);
    ctx.globalAlpha=0.9; ctx.strokeStyle=buildGhost.valid?'#22c55e':'#ef4444'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(gx,gy,s.w*TILE,s.h*TILE); ctx.setLineDash([]); ctx.globalAlpha=1;
    ctx.fillStyle='#fff'; ctx.font='10px Orbitron'; ctx.fillText(s.name.toUpperCase(),gx+4,gy-6);
  }
  // units
  for(let u of units){
    let spec=UNIT_SPEC[u.type];
    let sel=selected.includes(u);
    // shadow
    ctx.fillStyle='#0005'; ctx.beginPath(); ctx.ellipse(u.x,u.y+8, spec.size*0.9, spec.size*0.5,0,0,Math.PI*2); ctx.fill();
    // body
    let isPlayer=u.owner===PLAYER;
    let baseColor=isPlayer?spec.color: '#f87171';
    if(u.type==='tank') baseColor=isPlayer?'#facc15':'#fb7185';
    // hit flash
    let flash = u.lastHit && (Date.now()-u.lastHit)<120;
    ctx.fillStyle= flash?'#fff':baseColor;
    ctx.shadowColor=baseColor; ctx.shadowBlur= sel?12:6;
    if(u.type==='scv' || u.type==='drone'){
      // worker: small triangle
      ctx.beginPath(); ctx.arc(u.x,u.y,spec.size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#00101e'; ctx.beginPath(); ctx.arc(u.x,u.y,3,0,Math.PI*2); ctx.fill();
      if(u.carry>0){ ctx.fillStyle=u.carryType==='mineral'?'#38bdf8':'#4ade80'; ctx.fillRect(u.x-4,u.y-14,8,6); }
    } else if(u.type==='marine'){
      ctx.beginPath(); ctx.arc(u.x,u.y,spec.size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#0a1830'; ctx.fillRect(u.x-5,u.y-2,10,4);
      // gun
      ctx.fillStyle='#cfe8ff'; ctx.fillRect(u.x+6,u.y-1,7,2);
    } else if(u.type==='tank'){
      ctx.fillRect(u.x-spec.size/1.6,u.y-spec.size/1.4,spec.size*1.25,spec.size*0.9);
      ctx.fillStyle='#1e293b'; ctx.beginPath(); ctx.arc(u.x,u.y,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e2e8f0'; ctx.fillRect(u.x+4,u.y-2,14,3);
    } else if(u.type==='zergling'){
      ctx.beginPath(); ctx.arc(u.x,u.y,spec.size*0.9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#450a0a'; ctx.beginPath(); ctx.arc(u.x+3,u.y-2,2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(u.x+3,u.y+2,2,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0;
    // hp bar
    if(u.hp < u.maxHp || sel){
      let pct=u.hp/u.maxHp;
      let barW=22, barH=4;
      ctx.fillStyle='#111'; ctx.fillRect(u.x-barW/2,u.y-spec.size-10,barW,barH);
      ctx.fillStyle=pct>0.5?'#22c55e':pct>0.25?'#f59e0b':'#ef4444'; ctx.fillRect(u.x-barW/2,u.y-spec.size-10,barW*pct,barH);
    }
    // gather line
    if(sel && u.state==='gather' && u.gatherTarget){
      ctx.strokeStyle='#38bdf866'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(u.gatherTarget.x,u.gatherTarget.y); ctx.stroke(); ctx.setLineDash([]);
    }
    // selection circle
    if(sel){
      ctx.strokeStyle='#22d3ee'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(u.x,u.y,spec.size+5,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#22d3ee'; ctx.beginPath(); ctx.arc(u.x,u.y,2,0,Math.PI*2); ctx.fill();
    }
    // destination line for selected moving units
    if(sel && u.dest){
      ctx.strokeStyle='#ffffff44'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(u.dest.x,u.dest.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(u.dest.x,u.dest.y,3,0,Math.PI*2); ctx.fill();
    }
  }
  // projectiles
  for(let p of projectiles){
    ctx.fillStyle=p.owner===PLAYER?'#fde047':'#f87171'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    // trail
    ctx.fillStyle='#ffffff88'; ctx.beginPath(); ctx.arc(p.x-p.vx*0.5,p.y-p.vy*0.5,1.5,0,Math.PI*2); ctx.fill();
  }
  // effects
  for(let e of effects){
    let t=e.t/e.maxT;
    if(e.type==='move'){
      ctx.strokeStyle=e.isAttack?'#ef4444':'#22c55e'; ctx.lineWidth=2; ctx.globalAlpha=1-t;
      ctx.beginPath(); ctx.arc(e.x,e.y, 4+t*14, -Math.PI/2, -Math.PI/2 + Math.PI*1.8); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=e.isAttack?'#ef4444':'#22c55e'; ctx.fillRect(e.x-2,e.y-2,4,4);
    } else if(e.type==='hit'){
      ctx.fillStyle=`rgba(255,220,100,${1-t})`; ctx.beginPath(); ctx.arc(e.x,e.y, 3+t*8,0,Math.PI*2); ctx.fill();
    } else if(e.type==='explode'){
      ctx.fillStyle=`rgba(255,${100+t*80},0,${1-t})`; ctx.beginPath(); ctx.arc(e.x,e.y, 6+t*18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${1-t})`; ctx.beginPath(); ctx.arc(e.x,e.y, 2+t*6,0,Math.PI*2); ctx.fill();
    } else if(e.type==='buildDone'){
      ctx.strokeStyle=`rgba(34,197,94,${1-t})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(e.x,e.y, 10+t*20,0,Math.PI*2); ctx.stroke();
    } else if(e.type==='gather'){
      ctx.fillStyle=`rgba(56,189,248,${1-t})`; ctx.font=`${10+t*4}px Share Tech Mono`; ctx.fillText('+8',e.x, e.y - t*18);
    } else if(e.type==='rally'){
      ctx.strokeStyle=`rgba(6,182,212,${1-t})`; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(e.x,e.y, 5+t*10,0,Math.PI*2); ctx.stroke();
    }
  }
  // fog overlay
  for(let y=startY;y<=endY;y++) for(let x=startX;x<=endX;x++){
    let wx=x*TILE, wy=y*TILE;
    if(!explored[y][x]){ ctx.fillStyle='#020b18'; ctx.fillRect(wx,wy,TILE,TILE); }
    else if(fog[y][x]){ ctx.fillStyle='rgba(2,11,24,0.72)'; ctx.fillRect(wx,wy,TILE,TILE); }
  }
  // drag box
  ctx.restore();
  if(isDragging && dragStart && dragEnd){
    let x=Math.min(dragStart.x,dragEnd.x), y=Math.min(dragStart.y,dragEnd.y), w=Math.abs(dragEnd.x-dragStart.x), h=Math.abs(dragEnd.y-dragStart.y);
    ctx.fillStyle='rgba(34,211,238,0.12)'; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=1; ctx.setLineDash([4,3]); ctx.strokeRect(x,y,w,h); ctx.setLineDash([]);
  }
  // minimap render top layer after world
  renderMinimap();
}

function renderMinimap(){
  mctx.fillStyle='#020b18'; mctx.fillRect(0,0,200,200);
  let scaleX=200/WORLD_W, scaleY=200/WORLD_H;
  // terrain
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    let c= terrain[y][x]===1?'#1a2740': explored[y][x]?'#0a1830':'#020b18';
    if(fog[y][x] && explored[y][x]) c='#071120';
    mctx.fillStyle=c; mctx.fillRect(x*TILE*scaleX, y*TILE*scaleY, TILE*scaleX+0.6, TILE*scaleY+0.6);
  }
  // resources
  for(let r of resources){
    mctx.fillStyle=r.type==='mineral'?'#38bdf8':'#22c55e';
    mctx.fillRect(r.x*scaleX-2, r.y*scaleY-2,4,4);
  }
  // buildings
  for(let b of buildings){
    if(!explored[worldToTile(b.y)][worldToTile(b.x)] && b.owner!==PLAYER) continue;
    mctx.fillStyle=b.owner===PLAYER?'#60a5fa':'#ef4444';
    mctx.fillRect(b.x*scaleX, b.y*scaleY, b.w*scaleX, b.h*scaleY);
  }
  // units
  for(let u of units){
    if(fog[worldToTile(u.y)][worldToTile(u.x)] && u.owner!==PLAYER) continue;
    mctx.fillStyle=u.owner===PLAYER?'#38bdf8':'#f87171';
    mctx.beginPath(); mctx.arc(u.x*scaleX,u.y*scaleY,1.8,0,Math.PI*2); mctx.fill();
  }
  // camera rect
  mctx.strokeStyle='#22d3ee'; mctx.lineWidth=1; mctx.strokeRect(camera.x*scaleX, camera.y*scaleY, canvas.width*scaleX, canvas.height*scaleY);
}

// UI updates
function updateHUD(){
  document.getElementById('mineralCount').textContent=minerals;
  document.getElementById('gasCount').textContent=gas;
  document.getElementById('supplyCount').textContent=supplyUsed+'/'+supplyCap;
  document.getElementById('supplyCount').style.color= supplyUsed>=supplyCap?'#ef4444': supplyUsed>=supplyCap-2?'#f59e0b':'#cfe8ff';
  document.getElementById('timeCount').textContent=formatTime(gameTime);
}
function updateControlGroupsUI(){
  let el=document.getElementById('controlGroups');
  if(!el) return;
  el.innerHTML='';
  for(let i=0;i<10;i++){
    let grp=controlGroups[i];
    let alive=grp.filter(ent=> ent.hp>0 && (units.includes(ent)||buildings.includes(ent)));
    if(grp.length!==alive.length) controlGroups[i]=alive;
    let chip=document.createElement('button');
    chip.className='cgChip'+(alive.length?' has':'')+(selected.length && selected.every(s=>alive.includes(s)) && alive.length?' active':'');
    chip.title= alive.length? alive.map(e=>e.type).join(', ') : 'Empty — Ctrl+'+i+' to assign';
    chip.innerHTML='<span class="cgNum">'+i+'</span><span class="cgCount">'+(alive.length||'—')+'</span>';
    chip.onclick=()=>{
      if(alive.length){
        selected=[...alive];
        updateSelectionUI(); updateControlGroupsUI();
        log('Group '+i+' recalled ('+alive.length+')');
        // center camera on group like double-tap
        let cx=alive.reduce((s,u)=>s+u.x,0)/alive.length;
        let cy=alive.reduce((s,u)=>s+u.y,0)/alive.length;
        camera.x=clamp(cx - canvas.width/2,0,WORLD_W-canvas.width);
        camera.y=clamp(cy - canvas.height/2,0,WORLD_H-canvas.height);
      }
    };
    el.appendChild(chip);
  }
}
function updateSelectionUI(){
  let sc=document.getElementById('selContent');
  let hpBar=document.getElementById('selHP');
  if(!selected.length){
    sc.innerHTML='<span class="hint">No selection — drag to select units, right-click to move</span>';
    hpBar.classList.add('hidden'); document.getElementById('selQueue').innerHTML='';
    updateBuildButtons(); return;
  }
  // if single
  if(selected.length===1){
    let e=selected[0];
    if(e.w!==undefined){
      // building
      let spec=BUILDING_SPEC[e.type];
      sc.innerHTML=`<b>${spec.name}</b><br><span style="font-size:10px;color:#7aa8cf">${e.building? 'Under construction '+Math.floor(e.progress*100)+'%':'HP '+e.hp+'/'+e.maxHp} — ${spec.provides?'Supply +'+spec.provides:''}</span>`;
      let pct=e.hp/e.maxHp*100; document.getElementById('selHPFill').style.width=pct+'%'; hpBar.classList.remove('hidden');
      document.getElementById('selHPText').textContent=e.hp+'/'+e.maxHp;
      // queue display
      let q=document.getElementById('selQueue'); q.innerHTML='';
      if(e.producing) q.innerHTML+=`<span class="qItem" style="position:relative;overflow:hidden">${e.producing}<span class="bar" style="width:${((UNIT_SPEC[e.producing].time-e.prodTimer)/UNIT_SPEC[e.producing].time*100)}%"></span></span>`;
      e.queue.forEach(t=> q.innerHTML+=`<span class="qItem">${t}</span>`);
    } else {
      let spec=UNIT_SPEC[e.type];
      sc.innerHTML=`<b>${spec.name}</b> — ${e.state}<br><span style="font-size:10px;color:#7aa8cf">HP ${e.hp}/${spec.hp} | DMG ${spec.dmg} | Speed ${spec.speed}</span>${e.carry?' <br>Carrying '+e.carry+' '+e.carryType:''}`;
      let pct=e.hp/e.maxHp*100; document.getElementById('selHPFill').style.width=pct+'%'; hpBar.classList.remove('hidden');
      document.getElementById('selHPText').textContent=e.hp+'/'+e.maxHp;
      document.getElementById('selQueue').innerHTML='';
    }
  } else {
    // multi
    sc.innerHTML=`<div class="selGrid">`+selected.slice(0,12).map(e=>{
      let name=e.type, hp=e.hp||0, max=e.maxHp||1, pct=hp/max*100;
      return `<div class="selChip">${name}<b>${hp}</b><div class="hp"><i style="width:${pct}%"></i></div></div>`;
    }).join('')+(selected.length>12?`<div class="selChip">+${selected.length-12} more</div>`:'')+`</div>`;
    hpBar.classList.add('hidden'); document.getElementById('selQueue').innerHTML='';
  }
  updateBuildButtons();
}
function updateBuildButtons(){
  let grid=document.getElementById('buildGrid');
  grid.innerHTML='';
  let hasSCV=selected.some(s=>s.type==='scv' && s.owner===PLAYER && s.w===undefined);
  let hasCC=selected.some(s=>s.type==='cc' && s.owner===PLAYER && !s.building);
  let hasBarracks=selected.some(s=>s.type==='barracks' && s.owner===PLAYER && !s.building);
  document.getElementById('actionTitle').textContent= hasSCV?'SCV — BUILD': hasCC||hasBarracks?'PRODUCTION': 'COMMAND';
  if(hasSCV){
    Object.entries(BUILDING_SPEC).forEach(([key,spec])=>{
      let b=document.createElement('button'); b.className='buildBtn';
      let hk=key==='cc'?'C':key==='depot'?'S':key==='barracks'?'B':'R';
      b.innerHTML=`<span class="hotkey">${hk}</span><span class="bIcon">${key==='cc'?'🏢':key==='depot'?'📦':key==='barracks'?'🏭':'⛽'}</span><span class="bName">${spec.name}</span><span class="bCost">${spec.costM}M ${spec.costG?spec.costG+' G':''}</span>`;
      if(minerals<spec.costM||gas<spec.costG) b.disabled=true;
      b.onclick=()=>{ buildMode=key; buildGhost=null; log('Place '+spec.name+' — green=valid, red=blocked. Right-click cancel.'); };
      // highlight buildMode
      if(buildMode===key){ b.style.borderColor='#22c55e'; b.style.boxShadow='0 0 10px #22c55e88'; }
      grid.appendChild(b);
    });
  } else if(hasCC){
    let btns=[
      {unit:'scv', label:'Train SCV', icon:'👷'},
    ];
    btns.forEach(cfg=>{
      let spec=UNIT_SPEC[cfg.unit];
      let b=document.createElement('button'); b.className='buildBtn';
      b.innerHTML=`<span class="bIcon">${cfg.icon}</span><span class="bName">${cfg.label}</span><span class="bCost">${spec.costM}M • ${spec.time}s • ${spec.supply} sup</span>`;
      if(minerals<spec.costM||gas<spec.costG||supplyUsed+spec.supply>supplyCap) b.disabled=true;
      b.onclick=()=>{
        let cc=selected.find(s=>s.type==='cc' && !s.building);
        if(cc){ cc.queue.push(cfg.unit); minerals-=spec.costM; gas-=spec.costG; // pay upfront for simplicity? actually pay on push but we deducted; need to refund if cancel not implemented
        // Wait we deduct now; but we already deducted for building; for units deduct now
        // For units we already deducted above; but we deducted twice? fix: we deduct here once
        // We already did deduct? No we deduct minerals here. But we also need to not double deduct.
        // Actually we deduct here correct.
        log('Queued '+spec.name);
        // Oops we deducted minerals but also need to handle if not affordable after deduction? Already checked
        }
        // Correction: we deducted minerals but we used spec.costM already? The click handler already subtracts; that's fine single subtract.
        // But we subtracted after checking, that's one subtraction. Good.
        updateSelectionUI(); updateHUD();
      };
      // Fix double subtraction bug: we subtracted once, but the spec deduct above is that single. No double.
      // Need to override to not double subtract in future clicks: ensure we don't subtract in b.onclick creation closure incorrectly twice.
      // The line above does single subtract.
      grid.appendChild(b);
    });
    // Add supply depot quick build via SCV hint
    let hint=document.createElement('div'); hint.style.fontSize='10px'; hint.style.color='#5a8ab5'; hint.style.gridColumn='1 / span 2'; hint.textContent='Select an SCV to construct buildings';
    grid.appendChild(hint);
  } else if(hasBarracks){
    ['marine','tank'].forEach(unit=>{
      let spec=UNIT_SPEC[unit];
      let b=document.createElement('button'); b.className='buildBtn';
      b.innerHTML=`<span class="bIcon">${unit==='marine'?'🪖':'🚀'}</span><span class="bName">${spec.name}</span><span class="bCost">${spec.costM}M ${spec.costG?spec.costG+'G':''} • ${spec.supply} sup</span>`;
      if(minerals<spec.costM||gas<spec.costG||supplyUsed+spec.supply>supplyCap) b.disabled=true;
      b.onclick=()=>{
        let br=selected.find(s=>s.type==='barracks' && !s.building);
        if(br){ br.queue.push(unit); minerals-=spec.costM; gas-=spec.costG; log('Queued '+spec.name); updateHUD(); updateSelectionUI(); }
      };
      grid.appendChild(b);
    });
  } else {
    grid.innerHTML='<span class="hint">Select a unit or building to see commands.<br>SCV builds, Command Center trains workers, Barracks trains army.</span>';
  }
}

// camera movement
function updateCamera(dt){
  let speed=520*dt;
  if(keys['arrowleft']) camera.x-=speed;
  if(keys['arrowright']) camera.x+=speed;
  if(keys['arrowup']) camera.y-=speed;
  if(keys['arrowdown']) camera.y+=speed;
  if(keys['w']) camera.y-=speed;
  if(keys['d']) camera.x+=speed;
  // edge pan
  if(mouse.x<18) camera.x-=speed;
  if(mouse.x>canvas.width-18) camera.x+=speed;
  if(mouse.y<18) camera.y-=speed;
  if(mouse.y>canvas.height-18) camera.y+=speed;
  // Clamp
  camera.x=clamp(camera.x,0,WORLD_W-canvas.width);
  camera.y=clamp(camera.y,0,WORLD_H-canvas.height);
}

// minimap click
minimap.addEventListener('click', e=>{
  let rect=minimap.getBoundingClientRect();
  let x=(e.clientX-rect.left)/rect.width*WORLD_W;
  let y=(e.clientY-rect.top)/rect.height*WORLD_H;
  camera.x=clamp(x - canvas.width/2,0,WORLD_W-canvas.width);
  camera.y=clamp(y - canvas.height/2,0,WORLD_H-canvas.height);
});
minimap.addEventListener('mousemove', e=>{
  if(e.buttons===1){
    let rect=minimap.getBoundingClientRect();
    let x=(e.clientX-rect.left)/rect.width*WORLD_W;
    let y=(e.clientY-rect.top)/rect.height*WORLD_H;
    camera.x=clamp(x - canvas.width/2,0,WORLD_W-canvas.width);
    camera.y=clamp(y - canvas.height/2,0,WORLD_H-canvas.height);
  }
});

// buttons
document.getElementById('btnPause').onclick=()=>{paused=!paused; document.getElementById('btnPause').textContent=paused?'▶':'⏸'; log(paused?'Paused':'Resumed')};
document.getElementById('btnRestart').onclick=()=>location.reload();
document.getElementById('btnHelp').onclick=()=>document.getElementById('helpOverlay').classList.remove('hidden');
document.getElementById('helpClose').onclick=()=>document.getElementById('helpOverlay').classList.add('hidden');
document.getElementById('btnStart').onclick=()=>{
  document.getElementById('startScreen').style.display='none';
  initGame();
  requestAnimationFrame(loop);
};

// patch: fix movement keys correctly (separate handler)
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') keys['arrowleft']=true;
  if(e.key==='ArrowRight') keys['arrowright']=true;
  if(e.key==='ArrowUp') keys['arrowup']=true;
  if(e.key==='ArrowDown') keys['arrowdown']=true;
});
window.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft') keys['arrowleft']=false;
  if(e.key==='ArrowRight') keys['arrowright']=false;
  if(e.key==='ArrowUp') keys['arrowup']=false;
  if(e.key==='ArrowDown') keys['arrowdown']=false;
});

function loop(ts){
  if(!lastTime) lastTime=ts;
  let dt=Math.min(0.033,(ts-lastTime)/1000);
  lastTime=ts;
  if(!paused && !gameOver){
    updateCamera(dt);
    update(dt);
    updateHUD();
    if(frameCount%30===0) updateSelectionUI();
  }
  render();
  // fps
  if(frameCount%30===0) document.getElementById('fpsCounter').textContent=Math.round(1/dt)+' FPS';
  if(!gameOver) requestAnimationFrame(loop); else render(); // one final render
}

// auto-init if start screen hidden for testing
initMap(); initResources(); // placeholder to avoid errors before start
// Resize canvas to container
function resize(){
  let wrap=document.getElementById('canvasWrap');
  let w=wrap.clientWidth, h=wrap.clientHeight;
  // keep internal res but scale via CSS? Use fixed 1200x720 and let CSS scale
}
window.addEventListener('resize',resize);

// Expose for debug
window._game={get minerals(){return minerals}, set minerals(v){minerals=v}, get gas(){return gas}, set gas(v){gas=v}, buildings, units, resources};

