/* Headless integration test for the Step-1 table.
   Run:  npm i --no-save jsdom  &&  node test/dom-test.js            */
const fs=require('fs'), path=require('path');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(c,m)=>{c?pass++:(fail++,console.error('  x FAIL:',m));};
const ONLY=process.argv[2]?process.argv[2].split(',').map(Number):null;
const run=n=>!ONLY||ONLY.indexOf(n)>=0;

function mkdom(){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
  const w=dom.window;
  w.Element.prototype.animate=function(){return{onfinish:null,cancel(){},finish(){},effect:{target:this}};};
  return {dom,w,d:w.document};
}
function click(d,w,sel){
  const el=typeof sel==='string'?d.querySelector(sel):sel;
  if(!el) throw new Error('missing element: '+sel);
  el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  return el;
}
async function drive(d,w,{maxSteps=40000,giveProb=0.5}={}){
  let steps=0;
  while(steps++<maxSteps){
    const s=w.UI.state; if(!s) throw new Error('no state yet');
    if(s.phase==='complete'||d.querySelector('.overlay[data-ov="results"]')) return steps;
    const a=w.MK.actor(s);
    if(!a){await sleep(8);continue;}
    if(s.players[a.seat].kind==='bot'){await sleep(6);continue;}
    if(d.querySelector('.overlay[data-ov="curtain"]')){click(d,w,'[data-act="reveal"]');await sleep(4);continue;}
    if(a.kind==='pick'){
      const b=d.querySelector('#action-row [data-act="pick"]');
      if(!b) throw new Error('human pick turn but no pick button (viewer='+w.UI.viewer+' actor='+a.seat+')');
      click(d,w,b);
    } else {
      const tg=[...d.querySelectorAll('.seat.is-target')];
      const give=d.querySelector('#action-row [data-act="arm"]');
      const pas=d.querySelector('#action-row [data-act="pass"]');
      if(tg.length&&give&&Math.random()<giveProb){
        if(Math.random()<0.5){click(d,w,give);await sleep(2);}
        click(d,w,tg[Math.floor(Math.random()*tg.length)]);
      } else {
        if(!pas){
          // auto-pass may be in flight: wait for the table to move on before giving up
          let waited=0;
          while(waited<1500){
            await sleep(15); waited+=15;
            if(d.querySelector('#action-row [data-act="pass"]')||d.querySelector('#action-row [data-act="pick"]')) break;
            const a2=w.MK.actor(w.UI.state);
            if(!a2||a2.seat!==a.seat||a2.kind!==a.kind) break;
          }
          const pas2=d.querySelector('#action-row [data-act="pass"]');
          if(pas2){click(d,w,pas2);await sleep(4);continue;}
          if(d.querySelector('#action-row [data-act="pick"]')) continue;
          const a3=w.MK.actor(w.UI.state);
          if(!a3||a3.seat!==a.seat||a3.kind!==a.kind) continue;
          throw new Error('exchange turn with neither target nor pass button (seat '+a.seat+', targets '+tg.length+')');
        }
        click(d,w,pas);
      }
    }
    await sleep(4);
  }
  throw new Error('drive() exceeded '+maxSteps+' steps');
}

(async()=>{
  console.log('TEST 1 - boot + lobby rendering');
  if(run(1)) {
    const {w,d}=mkdom(); await sleep(80);
    ok(!!w.MK&&!!w.UI,'engine + UI globals exist');
    ok(d.querySelectorAll('#players-list .seat-row').length===4,'lobby shows 4 default seats');
    ok(d.querySelector('#seed-label').textContent.length>0,'seed label populated: '+d.querySelector('#seed-label').textContent);
    ok(d.querySelectorAll('#demo-a,#demo-b,#demo-c').length===3,'rule demo cards rendered');
    ok(d.querySelector('#demo-a').textContent.indexOf('K')>=0,'demo card A is a King');
    ok(d.querySelector('#screen-game').classList.contains('hidden'),'game screen hidden at boot');
    ok(d.querySelector('#seat-counter').textContent==='4 / 10','seat counter reads 4 / 10');
    // ---- donkey branding ----
    ok(d.querySelector('#donkey-badge')!==null,'donkey badge symbol present in the document');
    ok(d.querySelector('#donkey')!==null,'donkey silhouette symbol present');
    const bu=d.querySelector('.brand svg use');
    ok(bu&&bu.getAttribute('href')==='#donkey-badge','lobby brand mark is the donkey badge');
    ok(d.querySelector('.brand h1').textContent.replace(/\s/g,'')==='Donkeyyy','wordmark reads Donkeyyy (got "'+d.querySelector('.brand h1').textContent+'")');
    ok(d.title.indexOf('Donkeyyy')===0,'document title renamed');
    ok((d.querySelector('link[rel="icon"]')||{getAttribute:()=>''}).getAttribute('href').indexOf('data:image/svg+xml')===0,'favicon is the inline donkey');
    ok(!/Maut|MKN|Nanga/i.test(d.body.textContent),'no old name anywhere in the visible UI text');
    for(let i=0;i<8;i++) click(d,w,'#add-player');
    ok(d.querySelectorAll('#players-list .seat-row').length===10,'table grows to 10 seats');
    ok(d.querySelector('#add-player').disabled===true,'add-player disabled at 10');
    ok(d.querySelector('#seat-counter').textContent==='10 / 10','counter reads 10 / 10');
    for(let i=0;i<12;i++){const x=d.querySelector('#players-list [data-del]');if(x)click(d,w,x);}
    ok(d.querySelectorAll('#players-list .seat-row').length===2,'cannot drop below 2 seats');
    w.window.close();
  }

  console.log('TEST 2 - full game: 1 human + 3 bots, curtain OFF, autopass ON');
  if(run(2)) {
    const {w,d}=mkdom(); await sleep(80);
    w.roster.length=0;
    w.roster.push({name:'You',kind:'human'},{name:'Rohan',kind:'bot'},{name:'Zoya',kind:'bot'},{name:'Kabir',kind:'bot'});
    w.settings.curtain=false; w.settings.autopass=true; w.settings.speed=8; w.settings.sound=false;
    w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
    ok(!d.querySelector('#screen-game').classList.contains('hidden'),'game screen shown after start');
    ok(d.querySelectorAll('.seat').length===4,'4 seats rendered on the table');
    ok(w.UI.state.deck.length===52,'deck starts at 52');
    const bu2=d.querySelector('#deck .card.back use');
    ok(bu2&&bu2.getAttribute('href')==='#donkey','every card back carries the donkey emblem');
    ok(d.querySelector('#topbar .ttl svg use')!==null,'topbar chip is the donkey badge');
    const steps=await drive(d,w,{});
    const s=w.UI.state;
    ok(s.phase==='complete','reached completion in '+steps+' driver steps');
    ok(s.deck.length===0,'middle pile empty');
    const tot=s.players.reduce((x,p)=>x+p.stack.length,0);
    ok(tot===52,'all 52 cards in stacks, got '+tot);
    ok(s.picks===52,'52 picks recorded');
    await sleep(1700);
    ok(!!d.querySelector('.overlay[data-ov="results"]'),'results modal appeared');
    ok(d.querySelectorAll('.res-table tbody tr').length===4,'results table lists 4 players');
    ok(d.querySelector('.res-table tbody tr .trophy')!==null,'biggest-stack trophy rendered');
    const sum=[...d.querySelectorAll('.res-table tbody tr td:nth-child(3) b')].map(x=>+x.textContent).reduce((a,b)=>a+b,0);
    ok(sum===52,'results counts sum to 52, got '+sum);
    ok(d.querySelector('#st-deck').textContent==='0','topbar deck counter is 0');
    ok(d.querySelector('#st-picks').textContent==='52','topbar picks counter is 52');
    ok(d.querySelector('#loglist').children.length>10,'table log populated ('+d.querySelector('#loglist').children.length+' rows)');
    console.log('     gives:',s.gives,'| windows:',s.ex.windows,'| stacks:',s.players.map(p=>p.stack.length).join('/'));

    console.log('TEST 3 - replay reproduces the final table exactly');
    if(run(3)) {
      const before=JSON.stringify(s.players.map(p=>p.stack.map(c=>c.id)));
      click(d,w,'[data-act="rp-replay"]'); await sleep(80);
      ok(w.UI.replay!==null,'replay started');
      ok(!d.querySelector('.overlay[data-ov="results"]'),'results modal closed for the replay');
      ok(!!d.querySelector('[data-rp="stop"]'),'replay controls present in the dock');
      let guard=0;
      while(w.UI.replay&&w.UI.replay.i<w.UI.replay.acts.length&&guard++<8000) await sleep(3);
      await sleep(150);
      ok(JSON.stringify(w.UI.state.players.map(p=>p.stack.map(c=>c.id)))===before,'replayed table matches the original final table');
      ok(w.UI.replay.acts.length===w.UI.actions.length,'replay covered every recorded action ('+w.UI.replay.acts.length+')');
      click(d,w,'[data-rp="stop"]'); await sleep(60);
      ok(w.UI.replay===null,'replay exited');
      ok(JSON.stringify(w.UI.state.players.map(p=>p.stack.map(c=>c.id)))===before,'final state restored after exit');
    }
    console.log('TEST 4 - deal again + back to lobby');
    if(run(4)) {
      click(d,w,'[data-act="rp-again"]'); await sleep(60);
      ok(w.UI.state&&w.UI.state.phase!=='complete','fresh game started');
      ok(w.UI.state.deck.length===52,'new shuffle is a full deck');
      click(d,w,'#tb-exit'); await sleep(30);
      ok(!!d.querySelector('.overlay[data-ov="exit"]'),'exit confirmation shown');
      click(d,w,'[data-act="quit"]'); await sleep(30);
      ok(!d.querySelector('#screen-lobby').classList.contains('hidden'),'back in the lobby');
      ok(d.querySelectorAll('#players-list .seat-row').length===4,'roster preserved');
    }
    w.window.close();
  }

  console.log('TEST 5 - 2 humans, curtain ON, autopass OFF (every pass is manual)');
  if(run(5)) {
    const {w,d}=mkdom(); await sleep(80);
    w.roster.length=0; w.roster.push({name:'Aarav',kind:'human'},{name:'Meera',kind:'human'});
    w.settings.curtain=true; w.settings.autopass=false; w.settings.speed=8; w.settings.sound=false;
    w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
    let curtains=0,steps=0;
    while(steps++<80000){
      const s=w.UI.state; if(s.phase==='complete') break;
      if(d.querySelector('.overlay[data-ov="curtain"]')){curtains++;click(d,w,'[data-act="reveal"]');await sleep(3);continue;}
      const a=w.MK.actor(s); if(!a){await sleep(6);continue;}
      if(a.kind==='pick'){const b=d.querySelector('#action-row [data-act="pick"]');if(!b){await sleep(6);continue;}click(d,w,b);}
      else{
        const pas=d.querySelector('#action-row [data-act="pass"]');
        const tg=[...d.querySelectorAll('.seat.is-target')];
        const give=d.querySelector('#action-row [data-act="arm"]');
        if(tg.length&&give&&Math.random()<0.45){click(d,w,give);await sleep(2);click(d,w,tg[0]);}
        else if(pas) click(d,w,pas);
        else {await sleep(6);continue;}
      }
      await sleep(3);
    }
    const s=w.UI.state;
    ok(s.phase==='complete','2-player curtain game completed in '+steps+' steps');
    ok(curtains>10,'privacy curtain used '+curtains+' times');
    ok(s.players.reduce((x,p)=>x+p.stack.length,0)===52,'52 cards conserved');
    w.window.close();
  }

  console.log('TEST 6 - bogus input is refused without corrupting the table');
  if(run(6)) {
    const {w,d}=mkdom(); await sleep(80);
    w.roster.length=0; w.roster.push({name:'H1',kind:'human'},{name:'B1',kind:'bot'});
    w.settings.curtain=false; w.settings.autopass=true; w.settings.speed=1; w.settings.sound=false;
    w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
    let guard=0;
    while(guard++<6000){
      const a=w.MK.actor(w.UI.state);
      if(a&&w.UI.state.players[a.seat].kind==='human'&&w.UI.viewer===a.seat&&!d.querySelector('.overlay[data-ov="curtain"]')) break;
      await sleep(5);
    }
    const s=w.UI.state,a=w.MK.actor(s);
    const cardsBefore=s.deck.length+s.players.reduce((x,p)=>x+p.stack.length,0);
    w.tryGive(99); w.tryGive(-3);
    w.dispatch({t:'GIVE',from:a.seat,to:a.seat});
    w.dispatch({t:'BOGUS'}); w.dispatch(null); w.dispatch({});
    if(a.kind==='pick') w.doPass();
    const cardsAfter=s.deck.length+s.players.reduce((x,p)=>x+p.stack.length,0);
    ok(cardsBefore===52&&cardsAfter===52,'52 cards before and after bogus input ('+cardsBefore+'->'+cardsAfter+')');
    ok(!s.done,'game not corrupted into a finished state');
    w.window.close();
  }

  console.log('TEST 7 - dock peek chips follow the curtain setting');
  if(run(7)){
    {
      const {w,d}=mkdom(); await sleep(80);
      w.roster.length=0; w.roster.push({name:'Asha',kind:'human'},{name:'B1',kind:'bot'},{name:'Chirag',kind:'human'});
      w.settings.curtain=false; w.settings.autopass=true; w.settings.speed=8; w.settings.sound=false;
      w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
      ok(d.querySelectorAll('[data-view]').length===3,'curtain OFF -> 3 peek chips in the dock');
      click(d,w,'[data-view="2"]'); await sleep(10);
      ok(w.UI.viewer===2,'clicking a chip switches the dock viewer to seat 2');
      ok(d.querySelector('#dock-name').textContent.indexOf('Chirag')===0,'dock header follows the chip ('+d.querySelector('#dock-name').textContent+')');
      ok(d.querySelectorAll('#fan .fslot').length===w.UI.state.players[2].stack.length,'fan shows that seat\'s full stack');
      w.window.close();
    }
    {
      const {w,d}=mkdom(); await sleep(80);
      w.roster.length=0; w.roster.push({name:'Asha',kind:'human'},{name:'Chirag',kind:'human'});
      w.settings.curtain=true; w.settings.autopass=true; w.settings.speed=8; w.settings.sound=false;
      w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
      ok(d.querySelectorAll('[data-view]').length===0,'curtain ON -> no peek chips (no info leaks)');
      w.window.close();
    }
  }

  console.log('TEST 8 - the default table: 2 humans + 2 robots, curtain ON, autopass ON');
  if(run(8)){
    const {w,d}=mkdom(); await sleep(80);
    w.roster.length=0;
    w.roster.push({name:'You',kind:'human'},{name:'Meera',kind:'human'},{name:'Rohan',kind:'bot'},{name:'Zoya',kind:'bot'});
    w.settings.curtain=true; w.settings.autopass=true; w.settings.speed=10; w.settings.sound=false;
    w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
    ok(d.querySelectorAll('.seat').length===4,'4 seats built for the default table');
    const steps=await drive(d,w,{giveProb:0.6});
    const s=w.UI.state;
    ok(s.phase==='complete','default-config game completed in '+steps+' steps');
    ok(s.picks===52&&s.deck.length===0,'52 picks, pile empty');
    ok(s.players.reduce((x,p)=>x+p.stack.length,0)===52,'52 cards conserved');
    ok(d.querySelectorAll('[data-view]').length===0,'no peek chips while the curtain is on');
    await sleep(1700);
    ok(!!d.querySelector('.overlay[data-ov="results"]'),'results screen shown');
    console.log('     gives:',s.gives,'| windows:',s.ex.windows,'| stacks:',s.players.map(p=>p.stack.length).join('/'));
    w.window.close();
  }

  console.log('TEST 9 - the ping-pong loop cannot happen through the real UI');
  if(run(9)){
    const {w,d}=mkdom(); await sleep(80);
    w.roster.length=0; w.roster.push({name:'Asha',kind:'human'},{name:'Bilal',kind:'human'});
    w.settings.curtain=false; w.settings.autopass=false; w.settings.speed=8; w.settings.sound=false;
    w.renderRoster(); click(d,w,'#start-game'); await sleep(40);
    const s=w.UI.state;
    const C=(r,suit)=>({id:w.MK.SUITS[suit].k+r,r:w.MK.RANKS.indexOf(r),s:suit});
    // rebuild the exact position that used to soft-lock the table
    s.deck=[C('3',0)];
    s.players[0].stack=[C('Q',1),C('K',0)];      // Asha: Q under K
    s.players[1].stack=[C('Q',2)];               // Bilal: Q
    s.phase='exchange'; s.turn=0;
    s.ex={prompt:0,passed:[],gives:0,windows:1,seen:[w.MK.arrangeKey(s)],lastGive:null};
    w.UI.viewer=0; w.UI.actions=[]; w.render(); w.post(); await sleep(30);

    ok(w.MK.actor(s).seat===0,'Asha is the prompted seat');
    ok(d.querySelectorAll('.seat.is-target').length===1,'exactly one receiver is offered');
    ok(d.querySelector('.seat[data-seat="1"]').classList.contains('is-target'),'Bilal glows as the legal receiver');
    click(d,w,'.seat[data-seat="1"]'); await sleep(50);
    ok(s.players[1].stack.length===2&&w.MK.top(s.players[1]).id==='SK','give #1 committed through the UI (Bilal now shows K)');

    ok(w.MK.actor(s).seat===1,'prompt moved to Bilal');
    ok(d.querySelectorAll('.seat.is-target').length===0,'the give-back seat is not offered at all');
    ok(!d.querySelector('.seat[data-seat="0"]').classList.contains('is-target'),'Asha does not glow (it would rewind the table)');
    const line=d.querySelector('#action-line').textContent;
    ok(/hand it straight back|no usable give/i.test(line),'the dock explains why: "'+line.trim().slice(0,72)+'..."');

    const snap=JSON.stringify(s.players.map(p=>p.stack.map(c=>c.id)));
    w.tryGive(0); await sleep(40);
    ok(JSON.stringify(s.players.map(p=>p.stack.map(c=>c.id)))===snap,'a forced give-back changes nothing on the table');
    ok(s.last&&s.last.t==='reject'&&s.last.reason==='takeback','engine refused it as a take-back');
    ok(!!d.querySelector('.toast')&&/take-back/i.test(d.querySelector('.toast').textContent),'player is told why: "'+d.querySelector('.toast').textContent+'"');
    ok(d.querySelector('#loglist').innerHTML.indexOf('refused')>=0,'the refusal is written to the table log');
    ok(s.gives===1,'still exactly 1 give committed');

    click(d,w,'#action-row [data-act="pass"]'); await sleep(40);
    ok(w.MK.actor(s).seat===0,'prompt rotated to Asha after Bilal passed');
    click(d,w,'#action-row [data-act="pass"]'); await sleep(60);
    ok(s.phase!=='exchange','window closed after both passed -> phase is now '+s.phase+' (no soft-lock)');
    ok(s.deck.length===1,'the middle pile is untouched and ready for the next pick');
    w.window.close();
  }

  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(2);});
