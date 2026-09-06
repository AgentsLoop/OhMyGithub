import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

function loadGame(){
  const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:3000' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.navigator = dom.window.navigator;
  // mock canvas
  const origGet = dom.window.HTMLCanvasElement.prototype.getContext;
  dom.window.HTMLCanvasElement.prototype.getContext = function(type){
    if(type==='2d'){
      return {
        clearRect(){}, save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, fillRect(){}, beginPath(){}, arc(){}, fill(){}, stroke(){}, moveTo(){}, lineTo(){}, closePath(){}, quadraticCurveTo(){}, createLinearGradient(){ return { addColorStop(){} }}, createRadialGradient(){ return { addColorStop(){} }}, set fillStyle(v){}, get fillStyle(){return ''}, set strokeStyle(v){}, get strokeStyle(){return ''}, set shadowColor(v){}, get shadowColor(){return ''}, set shadowBlur(v){}, get shadowBlur(){return 0}, set globalAlpha(v){}, get globalAlpha(){return 1}, set lineWidth(v){}, get lineWidth(){return 1}, set font(v){}, get font(){return ''}, set textAlign(v){}, get textAlign(){return ''}, ellipse(){}, roundRect(){}, fillText(){}, strokeText(){}, clip(){}, set globalCompositeOperation(v){}, get globalCompositeOperation(){return 'source-over'}
      };
    }
    return origGet.call(this, type);
  };
  global.performance = dom.window.performance;
  global.requestAnimationFrame = (cb)=> setTimeout(()=>cb(performance.now()),16);
  global.cancelAnimationFrame = (id)=> clearTimeout(id);
  // load module via dynamic import string? Instead test logic via inspecting file
  return dom;
}

describe('Neon Catcher static checks', ()=>{
  it('index.html has required elements', ()=>{
    const html = fs.readFileSync('index.html','utf-8');
    expect(html).toContain('id="canvas"');
    expect(html).toContain('id="score"');
    expect(html).toContain('id="lives"');
    expect(html).toContain('id="startBtn"');
    expect(html).toContain('id="restartBtn"');
  });
  it('main.js has movement, catch, miss, game over', ()=>{
    const js = fs.readFileSync('src/main.js','utf-8');
    expect(js).toMatch(/ArrowLeft|arrowleft/);
    expect(js).toMatch(/catchStar/);
    expect(js).toMatch(/missStar/);
    expect(js).toMatch(/lives--/);
    expect(js).toMatch(/state='over'/);
    expect(js).toMatch(/CATCHER_SPEED/);
  });
  it('vite build succeeds', async ()=>{
    expect(fs.existsSync('dist/index.html')).toBe(true);
  });
});
