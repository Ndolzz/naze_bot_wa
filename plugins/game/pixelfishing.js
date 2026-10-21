/**
 * Pixel Fishing - mini game memancing bergaya pixel untuk bot WhatsApp.
 * Seluruh game (HTML/CSS/JS) ditanam pada konstanta GAME_HTML,
 * sehingga plugin berdiri sendiri tanpa membaca file dari disk.
 */

import { randomUUID } from "node:crypto";

export const config = {
  name: "pixelfishing",
  alias: ["pixelfish", "pfish"],
  category: "game",
  description:
    "Pixel Fishing: memancing pixel dengan 20 jenis ikan, 5 tingkat kelangkaan, dan koleksi tersimpan",
  usage: ".pixelfishing",
  example: ".pixelfish",
  cooldown: 5,
};

const GAME_HTML = String.raw`<!DOCTYPE html>
<html lang="id"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0b1522">
<title>Pixel Fishing</title>
<style>
:root{--bg:#0b1522;--p:#14263b;--p2:#1f3b5c;--ln:#050a12;--tx:#e6f0fa;--mt:#8aa3bd;--ac:#ffd447}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
html,body{margin:0;background:var(--bg);color:var(--tx);font:13px/1.35 "Courier New",Courier,monospace}
#app{max-width:440px;margin:0 auto;padding:8px 8px 24px}
button{font:inherit;color:inherit;touch-action:manipulation}
.btn{background:var(--p2);border:3px solid var(--ln);box-shadow:0 4px 0 var(--ln);padding:7px 10px;font-weight:bold;cursor:pointer}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ln)}
.btn:disabled{opacity:.45}
.btn.ac{background:var(--ac);color:#2a1a00}
.btn.sm{padding:4px 8px;font-size:12px}
#hud{background:var(--p);border:3px solid var(--ln);padding:6px 8px}
.hrow{display:flex;justify-content:space-between;gap:6px;font-weight:bold}
#xpbar,.bar{height:8px;background:#06101b;border:2px solid var(--ln);margin-top:5px;overflow:hidden}
#xpfill,.bar i{display:block;height:100%;background:#4cd37b;width:0}
#tabs{display:flex;gap:4px;margin:8px 0}
#tabs button{flex:1;padding:6px 0;background:var(--p);border:3px solid var(--ln);font-weight:bold;font-size:12px}
#tabs button.on{background:var(--ac);color:#2a1a00}
.view{display:none}.view.on{display:block}
#cvw{border:3px solid var(--ln);background:#000;line-height:0}
#cv{width:100%;height:auto;image-rendering:auto;display:block;touch-action:manipulation}
#stat{background:var(--p);border:3px solid var(--ln);border-top:0;padding:7px 9px;min-height:54px}
#stMsg{display:block;font-size:14px}
#stSub{display:block;color:var(--mt);font-size:12px;margin-top:2px}
.row2{display:flex;gap:6px;margin:8px 0}
.sel{flex:1;display:flex;align-items:center;justify-content:space-between;background:var(--p);border:3px solid var(--ln);padding:3px}
.sel span{flex:1;text-align:center;font-size:12px;font-weight:bold;padding:0 2px}
.sel button{background:var(--p2);border:2px solid var(--ln);width:28px;height:28px;font-weight:bold}
.big{width:100%;padding:18px 8px;font-size:18px;letter-spacing:1px;border:3px solid var(--ln);box-shadow:0 5px 0 var(--ln);font-weight:bold;cursor:pointer;background:var(--ac);color:#2a1a00}
.big:active{transform:translateY(4px);box-shadow:0 1px 0 var(--ln)}
.big.c-wait{background:#5aa0d6;color:#04121f}
.big.c-bite{background:#ff5a4d;color:#fff;animation:pulse .3s infinite alternate}
.big.c-fight{background:#4cd37b;color:#04210f}
.big.c-busy{background:#46556a;color:#cbd6e2}
@keyframes pulse{to{transform:scale(1.03)}}
#rodInfo{color:var(--mt);font-size:12px;margin-top:8px;text-align:center}
.panel{background:var(--p);border:3px solid var(--ln);padding:9px;margin-bottom:8px}
.panel h3{margin:0 0 6px;font-size:14px}
.muted{color:var(--mt)}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.chip{padding:3px 7px;border:2px solid var(--ln);background:var(--p2);font-size:11px;font-weight:bold}
.chip.on{background:var(--ac);color:#2a1a00}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.cc{background:var(--p);border:3px solid var(--ln);padding:5px 3px;text-align:center;cursor:pointer;min-height:84px}
.cc canvas{width:72px;height:44px;image-rendering:pixelated}
.cc .cn{font-size:11px;font-weight:bold;line-height:1.15}
.cc .cs{font-size:10px;color:var(--mt)}
.cc.off .cn{color:#52667d}
.item{display:flex;align-items:center;gap:8px;background:var(--p);border:3px solid var(--ln);padding:5px 7px;margin-bottom:6px}
.item canvas{width:72px;height:44px;image-rendering:pixelated;flex:none}
.item .inf{flex:1;min-width:0}
.item .inf b{display:block;font-size:12px}
.item .inf small{color:var(--mt);font-size:11px}
.tag{display:inline-block;padding:0 4px;border:2px solid var(--ln);font-size:10px;font-weight:bold;color:#000}
#modal{position:fixed;inset:0;background:rgba(3,8,14,.82);display:none;align-items:center;justify-content:center;padding:14px;z-index:20}
#modal.on{display:flex}
#mbox{width:100%;max-width:340px;max-height:92vh;overflow:auto;background:var(--p);border:4px solid var(--ln);box-shadow:0 0 0 3px var(--ln);padding:12px;text-align:center}
#mbox canvas.big-sp{width:108px;height:66px;image-rendering:pixelated;margin:8px auto;display:block}
.cname{font-size:17px;font-weight:bold;margin:4px 0}
.kv{display:flex;justify-content:space-between;font-size:12px;border-bottom:1px dashed #2d4560;padding:3px 0;text-align:left;gap:8px}
.kv span:last-child{text-align:right}
#toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000;border:3px solid var(--ac);padding:7px 12px;font-weight:bold;font-size:12px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:30;max-width:92%;text-align:center}
#toast.on{opacity:1}
textarea{width:100%;height:76px;background:#06101b;color:var(--tx);border:2px solid var(--ln);font:11px/1.2 "Courier New",monospace;padding:5px;-webkit-user-select:text;user-select:text;resize:none}
</style></head><body>
<div id="app">
  <div id="hud">
    <div class="hrow"><span id="hCoin">0</span><span id="hLv">Lv.1</span><span id="hTod">SIANG</span></div>
    <div id="xpbar"><i id="xpfill"></i></div>
  </div>
  <div id="tabs">
    <button data-v="fish" class="on">Mancing</button>
    <button data-v="col">Koleksi</button>
    <button data-v="bag">Tas</button>
    <button data-v="shop">Toko</button>
    <button data-v="data">Data</button>
  </div>

  <section class="view on" id="v-fish">
    <div id="cvw"><canvas id="cv" width="320" height="400"></canvas></div>
    <div id="stat"><b id="stMsg"></b><span id="stSub"></span></div>
    <div class="row2">
      <div class="sel"><button id="spL">&lt;</button><span id="spName"></span><button id="spR">&gt;</button></div>
      <div class="sel"><button id="bL">&lt;</button><span id="bName"></span><button id="bR">&gt;</button></div>
    </div>
    <button id="act" class="big">LEMPAR KAIL</button>
    <div id="rodInfo"></div>
  </section>
  <section class="view" id="v-col"></section>
  <section class="view" id="v-bag"></section>
  <section class="view" id="v-shop"></section>
  <section class="view" id="v-data"></section>
</div>
<div id="modal"><div id="mbox"></div></div>
<div id="toast"></div>

<script>
/*CORE_START*/
var Core=(function(){
var RAR=['UMUM','LANGKA','EPIK','LEGENDA','MITOS'];
var RCOL=['#9aa5b1','#4da3ff','#b46cff','#ffb02e','#ff4d6d'];
var RBASEW=[100,34,11,3.2,.8];
var RXP=[10,25,60,150,400];
var MAXLV=30;
var SPOTS=[
 {n:'Kolam Desa',lv:1,w:['#3f8f6b','#2f6f5a','#1f4a45']},
 {n:'Sungai Jernih',lv:4,w:['#4aa3c7','#3a82a8','#26597a']},
 {n:'Danau Kabut',lv:8,w:['#5a7fb0','#456596','#2f4572']},
 {n:'Laut Dangkal',lv:12,w:['#2f9fd0','#1f78b0','#124e82']}
];
var DEPTHN=['permukaan','tengah','dasar'];
var ROD=[
 {n:'Joran Ranting',zone:.22,luck:0,spd:0,react:0,cost:0,lv:1},
 {n:'Joran Bambu',zone:.26,luck:.06,spd:.08,react:.08,cost:300,lv:3},
 {n:'Joran Fiber',zone:.30,luck:.14,spd:.15,react:.16,cost:900,lv:6},
 {n:'Joran Karbon',zone:.34,luck:.25,spd:.22,react:.25,cost:2500,lv:10},
 {n:'Joran Mistis',zone:.38,luck:.40,spd:.30,react:.35,cost:7000,lv:15}
];
var BAIT={
 cacing:{n:'Cacing',luck:0,spd:0,gold:0,price:0,pack:0},
 udang:{n:'Udang',luck:.2,spd:.12,gold:0,price:60,pack:5},
 emas:{n:'Umpan Emas',luck:.6,spd:.2,gold:.04,price:150,pack:3}
};
var MS=[{n:5,c:150},{n:10,c:500},{n:15,c:1500},{n:20,c:6000}];
var SHAPES={
 std:['................','.....fff........','...f.fbbbb......','..ffbbpbbpbbb...','.fffbbpbbpbbbeb.','..ffssssssssss..','...f.sssssss....','................','................'],
 round:['................','......ffff......','....bbbbbbbb....','..f.bbpbbpbbb...','.ffbbbbbbbbbbeb.','.ffbssssssssbbb.','..f.ssssssssss..','....ssssssss....','......ffff......'],
 long:['................','................','...fffffffff....','.f.bbbbbbbbbbb..','fffbbpbbpbbpbeb.','.f.ssssssssssss.','...f.f..........','................','................'],
 flat:['................','................','......bbbb......','..bbbbbbbbbbbb..','fbbbbbbbbbbbebb.','.ffbbbbbbbbbbbb.','...ssssssssss...','......ssss......','................'],
 shark:['................','......f.........','.....ff.........','f...ffbbbb......','ffbbbbbbbbbbbbb.','.fbbbbbbbbbbbebb','..f.ssssssssss..','....f.f.........','................']
};
var SP=[
{id:'mas',n:'Ikan Mas',r:0,sh:'std',pal:['#f0902e','#ffd28a','#d96a1c','#fff0c0'],sp:[0,1],dp:[0,1],g:[250,1800],v:10,d:'Ikan hias jinak yang gampang ditemukan di kolam.'},
{id:'nila',n:'Ikan Nila',r:0,sh:'std',pal:['#7c8a8f','#c9d3d6','#5d6a6f','#4b5559'],sp:[0,1,2],dp:[1],g:[200,1500],v:9,d:'Penghuni air tawar paling umum. Doyan umpan apa saja.'},
{id:'lele',n:'Lele',r:0,sh:'long',pal:['#5b5560','#a39aa6','#443f4b','#3a3540'],sp:[0,1],dp:[2],g:[300,2200],v:11,d:'Suka bersembunyi di dasar yang berlumpur.'},
{id:'sepat',n:'Ikan Sepat',r:0,sh:'std',pal:['#c7b44a','#f0e7a0','#9d8c2e','#6f6420'],sp:[0,1,2],dp:[0],g:[40,250],v:7,d:'Kecil dan lincah, sering muncul di permukaan.'},
{id:'kembung',n:'Ikan Kembung',r:0,sh:'std',pal:['#4fa0b8','#d9f1f7','#2f7a92','#2a5f73'],sp:[3],dp:[0,1],g:[120,500],v:9,d:'Berenang berkelompok di laut dangkal.'},
{id:'tongkol',n:'Tongkol',r:0,sh:'shark',pal:['#3c6aa8','#c6d8ee','#2a4d82','#1d3560'],sp:[3],dp:[1],g:[500,3000],v:14,d:'Perenang cepat dengan tarikan lumayan kuat.'},
{id:'gurame',n:'Gurame',r:1,sh:'round',pal:['#a7864e','#e5d0a1','#7d6234','#5c4524'],sp:[0,1,2],dp:[1,2],g:[600,3500],v:45,d:'Berbadan bulat dan tenang. Dagingnya jadi incaran.'},
{id:'patin',n:'Patin Sungai',r:1,sh:'long',pal:['#8e9aa6','#e4e9ee','#66727e','#4c5762'],sp:[1,2],dp:[2],g:[800,5000],v:55,d:'Raksasa lembut dari dasar sungai.'},
{id:'gabus',n:'Ikan Gabus',r:1,sh:'long',pal:['#586b3f','#b8c28f','#3e4d2a','#2d3a1e'],sp:[0,2],dp:[1],g:[500,3500],v:50,d:'Predator galak yang suka menyergap umpan.'},
{id:'kakap',n:'Kakap Merah',r:1,sh:'round',pal:['#d8483b','#f6b5a8','#a8302a','#7e211c'],sp:[3],dp:[2],g:[800,4500],v:60,d:'Merah menyala dan berenang di dekat karang.'},
{id:'kerapu',n:'Kerapu Macan',r:1,sh:'round',pal:['#a6733c','#e6c28f','#7c5228','#3b2a18'],sp:[3],dp:[2],g:[1000,6000],v:65,d:'Bercak gelap di badan, mengintai di celah karang.'},
{id:'arwana',n:'Arwana Perak',r:2,sh:'long',pal:['#bfc9d4','#f5f8fb','#8f9cab','#6b7788'],sp:[1,2],dp:[0],g:[1500,6000],v:220,t:'siang',d:'Sisiknya berkilau saat matahari tinggi.'},
{id:'toman',n:'Ikan Toman',r:2,sh:'long',pal:['#3f5a3a','#a9c28e','#2c4128','#c9a43c'],sp:[2],dp:[1],g:[2500,9000],v:260,d:'Penguasa danau berkabut, rahangnya kuat.'},
{id:'barakuda',n:'Barakuda',r:2,sh:'shark',pal:['#6f8fa3','#dce8ef','#4d6a7d','#2f4757'],sp:[3],dp:[1],g:[2000,8000],v:240,d:'Gigi tajam dan serangan kilat.'},
{id:'manta',n:'Pari Manta',r:2,sh:'flat',pal:['#2f3f66','#d8dfee','#1f2b49','#161e34'],sp:[3],dp:[2],g:[8000,30000],v:300,d:'Melayang pelan, tapi tenaganya sangat besar.'},
{id:'koi',n:'Koi Emas',r:3,sh:'std',pal:['#ffffff','#fff3e6','#ff7a2f','#ff5a1f'],sp:[0,1,2],dp:[0,1],g:[1500,6500],v:800,t:'siang',d:'Konon membawa untung bagi yang menangkapnya.'},
{id:'hiu',n:'Hiu Karang',r:3,sh:'shark',pal:['#7d8c99','#eef2f5','#5b6a77','#3b4752'],sp:[3],dp:[2],g:[15000,60000],v:950,d:'Penjaga karang. Siap-siap senar tegang.'},
{id:'bulan',n:'Ikan Rembulan',r:3,sh:'round',pal:['#cfd8ff','#fafbff','#9aa8ee','#7685d4'],sp:[2,3],dp:[1],g:[3000,12000],v:1000,t:'malam',d:'Hanya muncul saat malam, bersinar lembut.'},
{id:'naga',n:'Naga Sungai',r:4,sh:'long',pal:['#2fd6a1','#c9ffe9','#139a74','#ffe066'],sp:[1,2],dp:[2],g:[5000,40000],v:3200,t:'malam',d:'Legenda dasar sungai. Hanya bangun di tengah malam.'},
{id:'leviathan',n:'Leviathan Mini',r:4,sh:'shark',pal:['#6a3fd1','#d6c8ff','#46279a','#ff4d9a'],sp:[3],dp:[2],g:[30000,200000],v:4000,t:'malam',d:'Bayi monster laut. Sangat jarang terlihat.'}
];
var BY={};SP.forEach(function(s){BY[s.id]=s});
function rnd(a,b){return a+Math.random()*(b-a)}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function tod(ms){var c=420000;return (ms%c)/c}
function phase(t){return t<.2?'pagi':t<.55?'siang':t<.7?'senja':'malam'}
function xpNeed(l){return Math.floor(50*Math.pow(l,1.55))}
function pick(spot,depth,t,luck,rf){
 rf=rf||Math.random;
 var night=phase(t)==='malam',c=[],tier=[0,0,0,0,0];
 SP.forEach(function(s){if(s.sp.indexOf(spot)>=0){c.push(s);tier[s.r]++}});
 var tw=[0,0,0,0,0],lost=0,r;
 for(r=0;r<5;r++){
  var w0=RBASEW[r]*(1+luck*r*1.1);
  if(tier[r])tw[r]=w0;else lost+=RBASEW[r];
 }
 tw[0]+=lost;
 var ws=[],tot=0;
 c.forEach(function(s){
  var w=tw[s.r]/tier[s.r];
  if(s.dp.indexOf(depth)<0)w*=.2;
  if(s.t){var m=(s.t==='malam')===night;w*=m?(s.r>=4?3:1.8):.1}
  ws.push(w);tot+=w;
 });
 var x=rf()*tot;
 for(var i=0;i<c.length;i++){x-=ws[i];if(x<=0)return c[i]}
 return c[c.length-1];
}
function size(sp,rf){
 rf=rf||Math.random;
 var f=(rf()+rf())/2,giant=false;
 if(rf()<.04){f=.9+rf()*.1;giant=true}
 return {w:Math.round(sp.g[0]+(sp.g[1]-sp.g[0])*f),f:f,giant:giant};
}
function sellValue(sp,w,gold){
 var f=clamp((w-sp.g[0])/(sp.g[1]-sp.g[0]),0,1);
 return Math.max(1,Math.round(sp.v*(.7+.9*f)*(gold?2.5:1)));
}
function fightInit(sp,rodIdx,rf){
 rf=rf||Math.random;
 var r=sp.r,rod=ROD[rodIdx];
 return {z:.3,vz:0,f:.6,tf:.6,next:.5,p:.28,t:0,dash:0,dashIn:3+rf()*3,
  size:rod.zone,spd:[.5,.62,.78,.95,1.12][r],er:[1.4,1.1,.9,.7,.55][r],
  gain:[.36,.32,.29,.26,.24][r],loss:[.14,.17,.20,.23,.26][r],r:r,why:''};
}
function fightStep(fs,dt,hold,rf){
 rf=rf||Math.random;
 if(dt>.05)dt=.05;
 fs.t+=dt;
 fs.vz+=(hold?3.2:-2.4)*dt;
 fs.vz*=Math.max(0,1-1.8*dt);
 fs.z+=fs.vz*dt;
 var half=fs.size/2;
 if(fs.z<half){fs.z=half;fs.vz=fs.vz<0?-fs.vz*.25:fs.vz}
 if(fs.z>1-half){fs.z=1-half;fs.vz=fs.vz>0?-fs.vz*.25:fs.vz}
 fs.next-=dt;
 if(fs.next<=0){fs.tf=.06+rf()*.88;fs.next=fs.er*(.5+rf())}
 if(fs.r>=3){
  fs.dashIn-=dt;
  if(fs.dashIn<=0){fs.dash=.5;fs.dashIn=3.5+rf()*3;fs.tf=.06+rf()*.88}
 }
 if(fs.dash>0)fs.dash-=dt;
 var sp=fs.spd*(fs.dash>0?2.1:1),d=fs.tf-fs.f,st=sp*dt;
 if(Math.abs(d)<=st)fs.f=fs.tf;else fs.f+=(d>0?st:-st);
 var inside=Math.abs(fs.f-fs.z)<=half;
 fs.p+=(inside?fs.gain:-fs.loss)*dt;
 fs.inside=inside;
 if(fs.p>=1){fs.p=1;return 'win'}
 if(fs.p<=0){fs.p=0;fs.why='lepas';return 'lose'}
 if(fs.t>30){fs.why='waktu';return 'lose'}
 return '';
}
function defaults(){
 return {v:1,coins:120,xp:0,lv:1,rod:0,spot:0,bait:'cacing',stock:{udang:3,emas:0},bag:[],cap:20,col:{},ms:[],
  st:{casts:0,caught:0,lost:0,best:0,earned:0,golden:0},snd:true};
}
function num(v,a,b,d){v=Number(v);if(!isFinite(v))return d;return Math.max(a,Math.min(b,Math.floor(v)))}
function sanitize(raw){
 var o=defaults();
 if(!raw||typeof raw!=='object')return o;
 o.coins=num(raw.coins,0,1e9,o.coins);o.xp=num(raw.xp,0,1e9,0);o.lv=num(raw.lv,1,MAXLV,1);
 o.rod=num(raw.rod,0,ROD.length-1,0);o.spot=num(raw.spot,0,SPOTS.length-1,0);
 o.bait=BAIT[raw.bait]?raw.bait:'cacing';
 var sk=raw.stock||{};
 o.stock={udang:num(sk.udang,0,9999,0),emas:num(sk.emas,0,9999,0)};
 o.cap=num(raw.cap,20,80,20);
 o.bag=[];
 (Array.isArray(raw.bag)?raw.bag:[]).slice(0,o.cap).forEach(function(it){
  if(it&&BY[it.i]){var s=BY[it.i];o.bag.push({i:it.i,w:num(it.w,1,1e7,s.g[0]),g:it.g?1:0})}
 });
 o.col={};
 if(raw.col&&typeof raw.col==='object')Object.keys(raw.col).forEach(function(k){
  if(BY[k]){var c=raw.col[k]||{};o.col[k]={n:num(c.n,1,1e7,1),best:num(c.best,0,1e7,0),gold:num(c.gold,0,1e7,0),first:num(c.first,0,4e12,0)}}
 });
 o.ms=Array.isArray(raw.ms)?raw.ms.filter(function(n){return MS.some(function(m){return m.n===n})}):[];
 var s=raw.st||{};
 o.st={casts:num(s.casts,0,1e9,0),caught:num(s.caught,0,1e9,0),lost:num(s.lost,0,1e9,0),best:num(s.best,0,1e8,0),earned:num(s.earned,0,1e12,0),golden:num(s.golden,0,1e9,0)};
 o.snd=raw.snd!==false;
 if(SPOTS[o.spot].lv>o.lv)o.spot=0;
 return o;
}
return {RAR:RAR,RCOL:RCOL,RXP:RXP,MAXLV:MAXLV,SPOTS:SPOTS,DEPTHN:DEPTHN,ROD:ROD,BAIT:BAIT,MS:MS,SHAPES:SHAPES,SP:SP,BY:BY,
 rnd:rnd,clamp:clamp,tod:tod,phase:phase,xpNeed:xpNeed,pick:pick,size:size,sellValue:sellValue,
 fightInit:fightInit,fightStep:fightStep,defaults:defaults,sanitize:sanitize};
})();
/*CORE_END*/

(function(){
'use strict';
var RAR=Core.RAR,RCOL=Core.RCOL,SP=Core.SP,BY=Core.BY,SPOTS=Core.SPOTS,ROD=Core.ROD,BAIT=Core.BAIT,MS=Core.MS,SHAPES=Core.SHAPES;
var rnd=Core.rnd,clamp=Core.clamp;
var $=function(id){return document.getElementById(id)};
var KEY='pixfish_v1';
var memStore=null;
function loadRaw(){try{var s=localStorage.getItem(KEY);return s?JSON.parse(s):null}catch(e){return memStore}}
var S=Core.sanitize(loadRaw());
function save(){try{memStore=JSON.parse(JSON.stringify(S));localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function fmt(n){return Math.round(n).toLocaleString('id-ID')}
function fw(g){return g>=1000?(g/1000).toFixed(2)+' kg':g+' g'}

/* ===== audio ===== */
var AC=null;
function tone(f,d,type,vol,when,slide){
 if(!S.snd)return;
 try{
  AC=AC||new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();
  var t=AC.currentTime+(when||0),o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'square';o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t+d);
  g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.02);
 }catch(e){}
}
function sfx(n){
 if(n==='cast')tone(300,.25,'square',.04,0,120);
 else if(n==='splash')tone(180,.18,'triangle',.06,0,60);
 else if(n==='nibble')tone(520,.06,'square',.025);
 else if(n==='bite'){tone(660,.1,'square',.06);tone(880,.14,'square',.06,.1)}
 else if(n==='hook'){tone(440,.08,'square',.05);tone(660,.1,'square',.05,.08)}
 else if(n==='win'){[523,659,784,1047].forEach(function(f,i){tone(f,.16,'square',.05,i*.1)})}
 else if(n==='epic'){[523,659,784,1047,1319,1568].forEach(function(f,i){tone(f,.2,'square',.055,i*.09)})}
 else if(n==='lose')tone(260,.35,'sawtooth',.05,0,70);
 else if(n==='coin'){tone(988,.07,'square',.04);tone(1319,.12,'square',.04,.07)}
 else if(n==='ui')tone(600,.04,'square',.025);
}
function vib(ms){try{if(navigator.vibrate)navigator.vibrate(ms)}catch(e){}}

/* ===== sprite (resolusi 2x: shading + outline tipis) ===== */
var SPR={};
var GOLD=['#ffd447','#fff2a8','#e09b1a','#ffffff'];
function shade(h,f){
 var r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16);
 return 'rgb('+clamp(Math.round(r*f),0,255)+','+clamp(Math.round(g*f),0,255)+','+clamp(Math.round(b*f),0,255)+')';
}
function sprite(sp,mode){
 var key=sp.id+mode;if(SPR[key])return SPR[key];
 var rows=SHAPES[sp.sh],w=16,h=9,K=2,cw=(w+2)*K,chh=(h+2)*K;
 var c=document.createElement('canvas');c.width=cw;c.height=chh;
 var x=c.getContext('2d');
 var pal=mode==='g'?GOLD:sp.pal,flat=(mode==='s'||mode==='w');
 var map={b:pal[0],s:pal[1],f:pal[2],p:pal[3],e:'#101820'},out='#0b1220';
 if(mode==='s')map={b:'#1d2f45',s:'#1d2f45',f:'#1d2f45',p:'#1d2f45',e:'#1d2f45'};
 if(mode==='w'){map={b:'#0a1a2a',s:'#0a1a2a',f:'#0a1a2a',p:'#0a1a2a',e:'#0a1a2a'};out='#0a1a2a'}
 var m=[],cc=[],i,j,dx,dy;
 for(j=0;j<h;j++)for(i=0;i<w;i++){
  var ch=rows[j].charAt(i);if(ch==='.'||ch==='')continue;
  for(dy=0;dy<K;dy++)for(dx=0;dx<K;dx++){
   var id=((j+1)*K+dy)*cw+(i+1)*K+dx;
   m[id]=1;cc[id]=(ch==='e')?((dx===0&&dy===0&&!flat)?'#ffffff':map.e):map[ch];
  }
 }
 function has(px,py){return px>=0&&py>=0&&px<cw&&py<chh&&m[py*cw+px]===1}
 for(var py=0;py<chh;py++)for(var q=0;q<cw;q++){
  if(has(q,py)){
   var col=cc[py*cw+q];
   if(!flat&&col.charAt(0)==='#'&&col!=='#ffffff'&&col!==map.e){
    if(!has(q,py-1))col=shade(col,1.3);
    else if(!has(q,py+1))col=shade(col,.7);
    else if(!has(q,py-2))col=shade(col,1.12);
    else if(!has(q,py+2))col=shade(col,.88);
   }
   x.fillStyle=col;x.fillRect(q,py,1,1);
  }else if(has(q+1,py)||has(q-1,py)||has(q,py+1)||has(q,py-1)){
   x.fillStyle=out;x.fillRect(q,py,1,1);
  }
 }
 SPR[key]=c;return c;
}
function blit(ctx,c,x,y,sc,flip,alpha){
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 if(alpha!=null)ctx.globalAlpha=alpha;
 if(flip){ctx.translate(x+c.width*sc,y);ctx.scale(-sc,sc);ctx.drawImage(c,0,0)}
 else{ctx.translate(x,y);ctx.scale(sc,sc);ctx.drawImage(c,0,0)}
 ctx.restore();
}

/* ===== scene ===== */
var cv=$('cv'),cx=cv.getContext('2d');
var W=160,H=200,SURF=64,BX=100;
var DEPTHY=[82,124,168];
function lerp(a,b,t){return a+(b-a)*t}
function hex(h){return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]}
function mix(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]}
function rgb(c,d){d=d||0;return 'rgb('+Math.round(c[0]*(1-d))+','+Math.round(c[1]*(1-d))+','+Math.round(c[2]*(1-d))+')'}
var SKY=[
 {t:0,top:hex('#3b3a6b'),bot:hex('#f2a46b'),n:.4},
 {t:.12,top:hex('#5b86c7'),bot:hex('#f6cf9a'),n:0},
 {t:.3,top:hex('#3f8fe0'),bot:hex('#9bd4f5'),n:0},
 {t:.55,top:hex('#4a95df'),bot:hex('#bfe3f7'),n:0},
 {t:.65,top:hex('#6a4f93'),bot:hex('#f08a4b'),n:.2},
 {t:.75,top:hex('#0b1230'),bot:hex('#1c2a5a'),n:1},
 {t:.95,top:hex('#1d2552'),bot:hex('#47467e'),n:.9},
 {t:1,top:hex('#3b3a6b'),bot:hex('#f2a46b'),n:.4}
];
function skyAt(t){
 for(var i=0;i<SKY.length-1;i++){
  if(t>=SKY[i].t&&t<=SKY[i+1].t){
   var k=(t-SKY[i].t)/(SKY[i+1].t-SKY[i].t);
   return {top:mix(SKY[i].top,SKY[i+1].top,k),bot:mix(SKY[i].bot,SKY[i+1].bot,k),n:lerp(SKY[i].n,SKY[i+1].n,k)};
  }
 }
 return SKY[0];
}
var STARS=[];for(var si=0;si<26;si++)STARS.push([(si*37+11)%W,(si*23+5)%44,si]);
var CLOUDS=[{x:10,y:10,s:1},{x:70,y:22,s:.8},{x:120,y:8,s:1.1}];
var bgFish=[];
function initBg(){
 bgFish=[];
 var list=SP.filter(function(s){return s.sp.indexOf(S.spot)>=0});
 for(var i=0;i<6;i++){
  var s=list[i%list.length];
  bgFish.push({sp:s,x:rnd(0,W),y:rnd(72,188),v:rnd(4,11)*(Math.random()<.5?-1:1)});
 }
}
var G={phase:'idle',t:0,tt:0,pw:0,pwd:1,depth:1,perfect:false,biteAt:0,nib:[],dip:0,biteT:0,biteWin:1,
 fs:null,sp:null,gold:false,holding:false,fx:[],modal:false,splashed:false,junk:false,bobX:BX};
function splash(x,y,n,col){
 for(var i=0;i<n;i++)G.fx.push({x:x,y:y,vx:rnd(-18,18),vy:rnd(-34,-10),l:rnd(.4,.8),c:col||'#dff3ff'});
}
function r2(v){return Math.round(v*2)/2}
function hl(x0,y0,x1,y1,col,sz){
 var dx=x1-x0,dy=y1-y0,n=Math.max(1,Math.ceil(Math.sqrt(dx*dx+dy*dy)*2));
 cx.fillStyle=col;
 for(var k=0;k<=n;k++)cx.fillRect(r2(x0+dx*k/n),r2(y0+dy*k/n),sz,sz);
}
function rodTip(t){
 var p=G.phase;
 if(p==='power')return [32+G.pw*6,34];
 if(p==='cast')return G.t<.2?[30,31]:[62,46];
 if(p==='bite')return [52,40+Math.sin(t*34)*1.4];
 if(p==='fight')return [54,44+Math.sin(t*16)*2+(G.fs?(G.fs.f-.5)*5:0)];
 return [52,38+Math.sin(t*2)*.6];
}
function bobPos(t){
 var tip=rodTip(t);
 if(G.phase==='cast'){
  var k=clamp((G.t-.2)/.35,0,1);
  return [lerp(tip[0],BX,k),lerp(tip[1],SURF,k)-Math.sin(Math.PI*k)*26];
 }
 if(G.phase==='idle'||G.phase==='power')return [tip[0]+2,tip[1]+14];
 var bx=G.bobX;
 if(G.phase==='fight'&&G.fs)bx=BX+Math.sin(t*9)*3+(G.fs.f-.5)*18;
 var by=SURF-1+G.dip*3.5;
 if(G.phase==='bite')by+=Math.sin(t*46)*1.2;
 return [bx,by];
}
var VIG=null;
function drawScene(now){
 cx.setTransform(2,0,0,2,0,0);
 var t=now/1000,td=Core.tod(Date.now()),sk=skyAt(td),night=sk.n,i,x,y;
 var N=64,bh=SURF/N;
 for(i=0;i<N;i++){cx.fillStyle=rgb(mix(sk.top,sk.bot,Math.pow(i/(N-1),1.25)));cx.fillRect(0,i*bh,W,bh+.3)}
 if(night>.2){
  cx.fillStyle='#fff';
  for(i=0;i<STARS.length;i++){
   var st=STARS[i],tw=.5+.5*Math.sin(t*2+st[2]*1.7),big=st[2]%3===0;
   cx.globalAlpha=Math.min(1,night)*tw;cx.fillRect(st[0],st[1],big?1:.5,big?1:.5);
  }
  cx.globalAlpha=1;
 }
 var sx,sy,sun=(td>=.02&&td<=.66),u;
 if(sun){u=(td-.02)/.64;sx=10+140*u;sy=40-30*Math.sin(Math.PI*u)}
 else{u=Math.min(1,(td>=.66?td-.66:td+.34)/.36);sx=10+140*u;sy=36-26*Math.sin(Math.PI*u)}
 var gc=sun?'255,225,140':'200,215,255';
 for(i=4;i>=1;i--){cx.fillStyle='rgba('+gc+','+(.05*(5-i))+')';cx.beginPath();cx.arc(sx,sy,3+i*3.2,0,6.283);cx.fill()}
 cx.fillStyle=sun?'#ffe58a':'#eef2ff';cx.beginPath();cx.arc(sx,sy,sun?4:3.4,0,6.283);cx.fill();
 if(sun){cx.fillStyle='#fff7d0';cx.beginPath();cx.arc(sx-1,sy-1,2,0,6.283);cx.fill()}
 else{cx.fillStyle='rgba(150,165,205,.7)';cx.fillRect(sx-1,sy-.5,1,1);cx.fillRect(sx+.5,sy+.5,1,.5)}
 CLOUDS.forEach(function(c){
  var cxp=((c.x+t*2*c.s)%(W+60))-30,cy=c.y;
  cx.globalAlpha=.85-night*.55;cx.fillStyle='#fff';
  cx.fillRect(r2(cxp),cy,18*c.s,3);cx.fillRect(r2(cxp+3*c.s),cy-2,11*c.s,2);cx.fillRect(r2(cxp+9*c.s),cy+3,13*c.s,2);
  cx.fillStyle='rgba(140,160,205,.5)';cx.fillRect(r2(cxp),cy+2.5,18*c.s,.5);
 });
 cx.globalAlpha=1;
 var hc=mix(sk.bot,[24,48,60],.5);
 cx.fillStyle=rgb(mix(hc,sk.bot,.35));
 for(x=0;x<W;x++){var h1=16+5*Math.sin(x*.04+2)+3*Math.sin(x*.11);cx.fillRect(x,SURF-h1,1,h1)}
 cx.fillStyle=rgb(hc);
 for(x=0;x<W;x++){var h2=9+4*Math.sin(x*.06+1)+2.5*Math.sin(x*.17);cx.fillRect(x,SURF-h2,1,h2)}
 var wc=SPOTS[S.spot].w.map(hex),dk=night*.45,WH=H-SURF;
 for(y=0;y<WH;y+=2){
  var uu=y/WH,col=uu<.45?mix(wc[0],wc[1],uu/.45):mix(wc[1],wc[2],(uu-.45)/.55);
  cx.fillStyle=rgb(col,dk);cx.fillRect(0,SURF+y,W,2.3);
 }
 if(sy<SURF-2){
  for(i=0;i<9;i++){
   var rw=Math.max(1.5,7-i*.7)+Math.sin(t*3+i)*1.2;
   cx.fillStyle='rgba('+gc+','+Math.max(0,(sun?.16:.3)-i*.02)+')';cx.fillRect(sx-rw/2,SURF+2+i*3.5,rw,1);
  }
 }
 if(night<.6){
  cx.fillStyle='rgba(255,255,255,.05)';
  for(i=0;i<4;i++){
   var bx0=14+i*40+Math.sin(t*.4+i)*4;
   cx.beginPath();cx.moveTo(bx0,SURF);cx.lineTo(bx0+8,SURF);cx.lineTo(bx0+22,SURF+80);cx.lineTo(bx0+6,SURF+80);cx.closePath();cx.fill();
  }
 }
 cx.fillStyle='rgba(220,240,250,.3)';
 for(i=0;i<16;i++){cx.fillRect(((i*37+t*6)%W),SURF+4+((i*53)%34)+Math.sin(t*2+i),1.5,.5)}
 cx.fillStyle=rgb(mix(hex('#6b5a3c'),[10,16,20],night*.6));cx.fillRect(0,H-8,W,8);
 cx.fillStyle=rgb(mix(hex('#8a7650'),[10,16,20],night*.6));cx.fillRect(0,H-8,W,1);
 for(x=0;x<W;x+=7)cx.fillRect(x+(x*3%5),H-5+(x%3),1.5,1);
 for(x=6;x<W;x+=22){
  var kh=12+((x*7)%9);
  for(i=0;i<kh;i+=2){
   cx.fillStyle=night>.5?'#1f4a3b':(i%4?'#2f8a54':'#3aa264');
   cx.fillRect(x+Math.sin(t*1.3+i*.35+x)*(i*.12),H-8-i-2,1.6,2.3);
  }
 }
 for(i=0;i<bgFish.length;i++){
  var b=bgFish[i];b.x+=b.v*.016;
  if(b.x>W+20)b.x=-20;if(b.x<-20)b.x=W+20;
  blit(cx,sprite(b.sp,'w'),r2(b.x),r2(b.y+Math.sin(t*1.6+i)*1.5),.5,b.v<0,.38);
 }
 cx.fillStyle='rgba(235,248,255,.5)';
 for(x=0;x<W;x+=2){cx.fillRect(x,SURF+Math.sin(x*.35+t*2.4)*.7,1.5,.5)}
 cx.fillStyle='rgba(200,230,245,.5)';
 for(i=0;i<7;i++){var by2=(H-((t*14+i*29)%130)-10);cx.fillRect(((i*23+t*3)%W),by2,.9,.9)}
 cx.fillStyle='#9a6a33';cx.fillRect(0,SURF,45,3);cx.fillStyle='#b98046';cx.fillRect(0,SURF,45,.8);
 cx.fillStyle='#5e3b1a';cx.fillRect(0,SURF+3,45,1);
 for(x=7;x<45;x+=7)cx.fillRect(x,SURF,.5,3);
 cx.globalAlpha=.8;cx.fillRect(6,SURF+4,3,18);cx.fillRect(37,SURF+4,3,18);cx.globalAlpha=1;
 var ay=SURF;
 cx.fillStyle='#2b3550';cx.fillRect(16,ay-8,3,7.5);cx.fillRect(21,ay-8,3,7.5);
 cx.fillStyle='#1a1f30';cx.fillRect(15.5,ay-1.5,4,1.5);cx.fillRect(20.5,ay-1.5,4,1.5);
 cx.fillStyle='#3d7fd9';cx.fillRect(15.5,ay-17,9,9.5);
 cx.fillStyle='#2f65b0';cx.fillRect(22,ay-17,2.5,9.5);
 cx.fillStyle='#5a9bf0';cx.fillRect(15.5,ay-17,9,1);
 cx.fillStyle='#e0a93a';cx.fillRect(15.5,ay-9.5,9,1);
 cx.fillStyle='#f3c9a0';cx.fillRect(17,ay-23,6.5,6);
 cx.fillStyle='#d9a97c';cx.fillRect(17,ay-18,6.5,.5);
 cx.fillStyle='#1a1a1a';cx.fillRect(21.5,ay-21,1,1);
 cx.fillStyle='#d94f3d';cx.fillRect(16,ay-24.5,9,1.5);cx.fillRect(17.5,ay-27,6,2.5);
 cx.fillStyle='#a83325';cx.fillRect(17.5,ay-25,6,.5);
 cx.fillStyle='#3d7fd9';cx.fillRect(23.5,ay-15.5,4,2);
 cx.fillStyle='#f3c9a0';cx.fillRect(27,ay-15,1.5,1.5);
 var tip=rodTip(t);
 hl(28,ay-14.5,tip[0],tip[1],'#8a5a2b',1);
 hl(28,ay-14.5,tip[0],tip[1]-.5,'#b07a42',.5);
 var bp=bobPos(t),bx=bp[0],by=bp[1];
 if(G.phase!=='idle'&&G.phase!=='result'){
  var sag=G.phase==='cast'?5:3;
  cx.fillStyle='rgba(240,248,252,.85)';
  for(i=1;i<=44;i++){var q=i/44,lx=lerp(tip[0],bx,q),ly=lerp(tip[1],by,q)+Math.sin(Math.PI*q)*sag;cx.fillRect(lx,ly,.6,.6)}
  if(G.phase==='wait'||G.phase==='bite'||G.phase==='fight'){
   var hy=DEPTHY[G.depth];
   cx.fillStyle='rgba(220,240,250,.55)';cx.fillRect(bx,by+2,.5,hy-by-2);
   cx.fillStyle='#d8e4ee';cx.fillRect(bx-1,hy,2.5,.5);cx.fillRect(bx-1,hy,.5,2);cx.fillRect(bx-1,hy+1.5,1.5,.5);
   for(i=0;i<2;i++){
    var rr=(t*.8+i*.5)%1;
    cx.strokeStyle='rgba(255,255,255,'+(.45*(1-rr))+')';cx.lineWidth=.5;
    cx.beginPath();cx.ellipse(bx,SURF+1,2+rr*8,.8+rr*2,0,0,6.283);cx.stroke();
   }
  }
 }
 if(G.phase==='cast'||G.phase==='wait'||G.phase==='bite'||G.phase==='fight'){
  cx.fillStyle='#050a12';cx.fillRect(bx-2,by-3.5,4,5.5);
  cx.fillStyle='#ff4d4d';cx.fillRect(bx-1.5,by-3,3,2);
  cx.fillStyle='#fff';cx.fillRect(bx-1.5,by-1,3,2);
  cx.fillStyle='#ff4d4d';cx.fillRect(bx-.25,by-4.5,.5,1.5);
 }
 if(G.phase==='bite'){
  var jy=Math.abs(Math.sin(t*14))*3,ey=by-23-jy;
  cx.fillStyle='#fff';cx.fillRect(bx-2.5,ey-1,5,12);
  cx.fillStyle='#ff3b3b';cx.fillRect(bx-1.5,ey,3,6.5);cx.fillRect(bx-1.5,ey+8,3,2);
 }
 if(G.phase==='fight'&&G.sp&&G.fs){
  var fsx=bx-14+Math.sin(t*12)*2,fsy=DEPTHY[G.depth]-8+(G.fs.f-.5)*14;
  blit(cx,sprite(G.sp,G.gold?'g':'s'),r2(fsx),r2(fsy),1,true,.95);
 }
 if(G.phase==='power'){
  cx.fillStyle='#050a12';cx.fillRect(21,174,118,18);
  var segc=['#5aa0d6','#3a7fb0','#26597a'];
  for(i=0;i<3;i++){cx.fillStyle=segc[i];cx.fillRect(24+i*37,178,37,10);cx.fillStyle='rgba(255,255,255,.18)';cx.fillRect(24+i*37,178,37,1.5)}
  cx.fillStyle='rgba(255,255,255,.45)';
  for(i=0;i<3;i++)cx.fillRect(24+i*37+17.5,178,2,10);
  cx.fillStyle='#050a12';cx.fillRect(24+G.pw*109-1,173,5,19);
  cx.fillStyle='#ffd447';cx.fillRect(24+G.pw*109,174,3,17);
  cx.fillStyle='#fff';cx.font='bold 7px "Courier New",monospace';cx.textBaseline='top';
  cx.fillText('ATAS',33,166);cx.fillText('TENGAH',64,166);cx.fillText('DASAR',103,166);
 }
 if(G.phase==='fight'&&G.fs){
  var fs=G.fs,TX=143,TY=74,TW=11,TH=112,half=fs.size/2,fc=RCOL[fs.r];
  cx.fillStyle='#050a12';cx.fillRect(TX-9,TY-4,TW+15,TH+8);
  cx.fillStyle=fc;cx.globalAlpha=.85;cx.fillRect(TX-.5,TY-.5,TW+1,TH+1);cx.globalAlpha=1;
  cx.fillStyle='#0d2236';cx.fillRect(TX,TY,TW,TH);
  cx.fillStyle='rgba(255,255,255,.08)';for(i=1;i<8;i++)cx.fillRect(TX,TY+TH*i/8,TW,.5);
  var zy=TY+(1-(fs.z+half))*TH,zh=fs.size*TH;
  cx.fillStyle=fs.inside?'rgba(90,230,110,.9)':'rgba(70,170,90,.6)';cx.fillRect(TX,zy,TW,zh);
  cx.fillStyle='rgba(255,255,255,.35)';cx.fillRect(TX,zy,TW,.8);cx.fillRect(TX,zy+zh-.8,TW,.8);
  var fy=TY+(1-fs.f)*TH;
  cx.fillStyle=fc;cx.strokeStyle='#050a12';cx.lineWidth=1;cx.beginPath();
  cx.moveTo(TX+.5,fy);cx.lineTo(TX+3,fy-2.5);cx.lineTo(TX+TW-1.5,fy-2);cx.lineTo(TX+TW-.5,fy);cx.lineTo(TX+TW-1.5,fy+2);cx.lineTo(TX+3,fy+2.5);cx.closePath();cx.stroke();cx.fill();
  cx.fillStyle='#fff';cx.fillRect(TX+TW-3.5,fy-1,1,1);
  cx.fillStyle='#050a12';cx.fillRect(TX-7,TY-.5,5,TH+1);
  cx.fillStyle='#0d2236';cx.fillRect(TX-6.5,TY,4,TH);
  var pc=fs.p<.34?'#ff5a4d':fs.p<.67?'#ffd447':'#4cd37b';
  cx.fillStyle=pc;cx.fillRect(TX-6.5,TY+(1-fs.p)*TH,4,fs.p*TH);
 }
 for(i=G.fx.length-1;i>=0;i--){
  var f=G.fx[i];cx.globalAlpha=clamp(f.l*2.5,0,1);cx.fillStyle=f.c;cx.fillRect(f.x,f.y,1,1);
 }
 cx.globalAlpha=1;
 if(night>.1){cx.fillStyle='rgba(5,10,30,'+(night*.22)+')';cx.fillRect(0,0,W,H)}
 if(!VIG){VIG=cx.createRadialGradient(80,100,55,80,100,135);VIG.addColorStop(0,'rgba(0,0,0,0)');VIG.addColorStop(1,'rgba(0,0,12,.38)')}
 cx.fillStyle=VIG;cx.fillRect(0,0,W,H);
}

/* ===== ui helpers ===== */
var toastT=0;
function toast(t){var e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){e.classList.remove('on')},1900)}
function setMsg(a,b){$('stMsg').textContent=a;$('stSub').textContent=b||''}
function todName(){return Core.phase(Core.tod(Date.now())).toUpperCase()}
function updHud(){
 $('hCoin').textContent='Koin '+fmt(S.coins);
 $('hLv').textContent='Lv.'+S.lv;
 $('hTod').textContent=todName();
 var need=Core.xpNeed(S.lv);
 $('xpfill').style.width=(S.lv>=Core.MAXLV?100:clamp(S.xp/need*100,0,100))+'%';
}
function syncUi(){
 var a=$('act'),p=G.phase,lab={idle:'LEMPAR KAIL',power:'LEPAS SEKARANG!',cast:'MELEMPAR...',wait:'ANGKAT KAIL',bite:'KAIT!!!',fight:'TAHAN UNTUK REEL',result:'...'};
 a.textContent=lab[p]||'';
 a.className='big'+(p==='wait'?' c-wait':p==='bite'?' c-bite':p==='fight'?' c-fight':(p==='cast'||p==='result')?' c-busy':'');
 $('spName').textContent=SPOTS[S.spot].n;
 var b=BAIT[S.bait];
 $('bName').textContent=b.n+(S.bait==='cacing'?'':' x'+S.stock[S.bait]);
 var r=ROD[S.rod];
 $('rodInfo').textContent=r.n+' | zona '+Math.round(r.zone*100)+'% | keberuntungan +'+Math.round(r.luck*100)+'%';
 updHud();
}
function msgIdle(){setMsg('Siap memancing','Pilih spot dan umpan, lalu tekan LEMPAR KAIL.')}

/* ===== game flow ===== */
function startPower(){
 if(S.bait!=='cacing'&&S.stock[S.bait]<=0){S.bait='cacing';toast('Umpan habis, pakai cacing.')}
 G.phase='power';G.pw=0;G.pwd=1;G.t=0;
 setMsg('Tentukan kedalaman','Tekan lagi saat penanda di zona yang kamu mau. Tengah zona = lemparan sempurna.');
 syncUi();sfx('ui');
}
function releaseCast(){
 var p=G.pw;G.depth=p<.333?0:p<.667?1:2;
 var cen=[.167,.5,.833][G.depth];
 G.perfect=Math.abs(p-cen)<.05;
 if(S.bait!=='cacing')S.stock[S.bait]--;
 S.st.casts++;save();
 G.phase='cast';G.t=0;G.splashed=false;G.dip=0;
 setMsg('Melempar kail...',G.perfect?'Lemparan sempurna! Peluang ikan langka naik.':'Kedalaman: '+Core.DEPTHN[G.depth]+'.');
 syncUi();sfx('cast');
}
function setupWait(){
 var rod=ROD[S.rod],bt=BAIT[S.bait];
 var total=Math.max(.9,rnd(1.8,5)*(1-rod.spd-bt.spd));
 G.biteAt=total;G.nib=[];
 var n=Math.floor(rnd(0,3));
 for(var i=0;i<n;i++)G.nib.push(rnd(.35*total,total-.55));
 G.nib.sort(function(a,b){return a-b});
 G.t=0;
}
function cancelWait(){
 var early=G.dip>.15;
 G.phase='idle';G.dip=0;
 setMsg(early?'Terlalu cepat!':'Kail ditarik kosong',early?'Ikan kabur karena kamu menarik saat masih mengintai.':'Umpan terbuang. Coba lempar lagi.');
 S.st.lost++;save();syncUi();sfx('lose');
}
function startBite(){
 G.phase='bite';G.biteT=0;G.biteWin=.85+ROD[S.rod].react;G.dip=1;
 setMsg('IKAN MENYAMBAR!','Tekan KAIT sekarang!');
 syncUi();sfx('bite');vib(60);
 splash(BX,SURF,4);
}
function missBite(){
 G.phase='idle';G.dip=0;S.st.lost++;save();
 setMsg('Ikan lolos','Terlambat mengait. Lebih cepat lain kali.');
 syncUi();sfx('lose');
}
function doHook(){
 var rod=ROD[S.rod],bt=BAIT[S.bait];
 var luck=rod.luck+bt.luck+(G.perfect?.15:0);
 G.junk=Math.random()<.07;
 sfx('hook');vib(30);
 if(G.junk){
  var j=['Sepatu Bekas','Kaleng Karat','Rumput Laut','Ranting Basah'][Math.floor(Math.random()*4)],c=Math.floor(rnd(2,7));
  S.coins+=c;G.phase='idle';G.dip=0;save();syncUi();
  setMsg('Dapat '+j,'Bukan ikan. Dijual jadi '+c+' koin.');return;
 }
 var sp=Core.pick(S.spot,G.depth,Core.tod(Date.now()),luck);
 G.sp=sp;
 G.gold=Math.random()<(.03+rod.luck*.02+bt.gold);
 G.fs=Core.fightInit(sp,S.rod);
 G.holding=false;G.dip=0;
 G.phase='fight';
 setMsg('Ikan terkait! Warna bilah = kelangkaan','Tahan tombol agar zona hijau naik, lepas agar turun. Jaga ikan tetap di zona.');
 syncUi();
}
function fightLost(why){
 G.phase='idle';G.holding=false;S.st.lost++;save();
 setMsg(why==='waktu'?'Ikan kabur':'Ikan lepas dari kail','Jaga ikan tetap di dalam zona hijau.');
 syncUi();sfx('lose');vib(120);
}
function xpGain(n){
 var up=[];
 S.xp+=n;
 while(S.lv<Core.MAXLV&&S.xp>=Core.xpNeed(S.lv)){S.xp-=Core.xpNeed(S.lv);S.lv++;up.push(S.lv)}
 if(S.lv>=Core.MAXLV)S.xp=0;
 return up;
}
function landed(){
 var sp=G.sp,gold=G.gold,sz=Core.size(sp),w=sz.w;
 var val=Core.sellValue(sp,w,gold);
 var c=S.col[sp.id],isNew=!c;
 if(!c){c=S.col[sp.id]={n:0,best:0,gold:0,first:Date.now()}}
 c.n++;if(w>c.best)c.best=w;if(gold)c.gold++;
 var sold=false;
 if(S.bag.length>=S.cap){S.coins+=val;S.st.earned+=val;sold=true}else{S.bag.push({i:sp.id,w:w,g:gold?1:0})}
 S.st.caught++;if(gold)S.st.golden++;if(w>S.st.best)S.st.best=w;
 var xp=Math.round(Core.RXP[sp.r]*(gold?1.5:1)*(.8+sz.f*.4)*(isNew?1.5:1));
 var oldLv=S.lv,up=xpGain(xp);
 var unlocked=[];
 SPOTS.forEach(function(s){if(s.lv>oldLv&&s.lv<=S.lv)unlocked.push(s.n)});
 save();
 G.phase='result';G.holding=false;
 splash(BX,SURF,14,RCOL[sp.r]);
 syncUi();
 sfx(sp.r>=2||gold?'epic':'win');vib(sp.r>=2?[60,40,60]:40);
 showCatch({sp:sp,w:w,gold:gold,val:val,isNew:isNew,giant:sz.giant,xp:xp,sold:sold,up:up,unlocked:unlocked});
}

/* ===== modal ===== */
function openModal(html,color){
 var b=$('mbox');b.innerHTML=html;b.style.borderColor=color||'#050a12';
 $('modal').classList.add('on');G.modal=true;
}
function closeModal(){
 $('modal').classList.remove('on');G.modal=false;
 if(G.phase==='result'){G.phase='idle';msgIdle();syncUi()}
}
function drawBig(id,sp,mode){
 var c=$(id);if(!c)return;
 var x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
 blit(x,sprite(sp,mode),0,0,3,false);
}
function showCatch(o){
 var sp=o.sp,col=RCOL[sp.r];
 var tags='';
 if(o.isNew)tags+='<span class="tag" style="background:#4cd37b">BARU!</span> ';
 if(o.gold)tags+='<span class="tag" style="background:#ffd447">EMAS x2.5</span> ';
 if(o.giant)tags+='<span class="tag" style="background:#ff9f43">RAKSASA</span> ';
 var h='<div style="color:'+col+';font-weight:bold;letter-spacing:2px">'+RAR[sp.r]+'</div>'+
  '<canvas id="mc" class="big-sp" width="108" height="66"></canvas>'+
  '<div class="cname" style="color:'+(o.gold?'#ffd447':'#fff')+'">'+sp.n+'</div><div>'+tags+'</div>'+
  '<div style="margin-top:8px">'+
  '<div class="kv"><span>Berat</span><span>'+fw(o.w)+'</span></div>'+
  '<div class="kv"><span>Nilai jual</span><span>'+fmt(o.val)+' koin</span></div>'+
  '<div class="kv"><span>XP</span><span>+'+o.xp+'</span></div></div>';
 if(o.sold)h+='<div class="muted" style="margin-top:6px">Tas penuh. Ikan langsung dijual.</div>';
 if(o.up.length)h+='<div style="color:#4cd37b;font-weight:bold;margin-top:6px">LEVEL '+S.lv+'!</div>';
 if(o.unlocked.length)h+='<div style="color:#ffd447;margin-top:2px">Spot baru: '+o.unlocked.join(', ')+'</div>';
 h+='<button id="mok" class="btn ac" style="width:100%;margin-top:10px">LANJUT</button>';
 openModal(h,col);
 drawBig('mc',sp,o.gold?'g':'n');
 $('mok').onclick=function(){sfx('ui');closeModal()};
}

/* ===== tabs / views ===== */
var curView='fish',colFilter=-1;
function showView(v){
 if(G.phase!=='idle'&&v!==curView){toast('Selesaikan dulu sesi memancing.');return}
 curView=v;
 ['fish','col','bag','shop','data'].forEach(function(n){var e=$('v-'+n);if(e)e.classList.toggle('on',n===v)});
 var tb=document.querySelectorAll('#tabs button');
 for(var i=0;i<tb.length;i++)tb[i].classList.toggle('on',tb[i].getAttribute('data-v')===v);
 if(v==='col')renderCol();else if(v==='bag')renderBag();else if(v==='shop')renderShop();else if(v==='data')renderData();
 sfx('ui');
}
function miniCanvas(host,sp,mode){
 var c=host.querySelector('canvas');if(!c)return;
 var x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
 blit(x,sprite(sp,mode),0,0,1,false);
}
function renderCol(){
 var v=$('v-col'),have=Object.keys(S.col).length,tot=SP.length;
 var h='<div class="panel"><h3>Koleksi '+have+'/'+tot+' ('+Math.round(have/tot*100)+'%)</h3><div class="bar"><i style="width:'+(have/tot*100)+'%"></i></div>';
 h+='<div class="chips">';
 MS.forEach(function(m){
  var claimed=S.ms.indexOf(m.n)>=0,ok=have>=m.n;
  h+='<button class="btn sm'+(ok&&!claimed?' ac':'')+'" data-ms="'+m.n+'"'+(!ok||claimed?' disabled':'')+'>'+m.n+' spesies: '+(claimed?'diambil':fmt(m.c)+' koin')+'</button>';
 });
 h+='</div><div class="chips"><span class="chip'+(colFilter<0?' on':'')+'" data-f="-1">Semua</span>';
 RAR.forEach(function(r,i){h+='<span class="chip'+(colFilter===i?' on':'')+'" data-f="'+i+'">'+r+'</span>'});
 h+='</div></div><div class="grid">';
 SP.forEach(function(s){
  if(colFilter>=0&&s.r!==colFilter)return;
  var c=S.col[s.id];
  h+='<div class="cc'+(c?'':' off')+'" data-id="'+s.id+'" style="border-color:'+(c?RCOL[s.r]:'#050a12')+'"><canvas width="36" height="22"></canvas><div class="cn">'+(c?s.n:'???')+'</div><div class="cs">'+(c?('x'+c.n+(c.gold?' | emas '+c.gold:'')):RAR[s.r])+'</div></div>';
 });
 h+='</div>';
 v.innerHTML=h;
 var cards=v.querySelectorAll('.cc');
 for(var i=0;i<cards.length;i++){
  (function(el){
   var s=BY[el.getAttribute('data-id')];
   miniCanvas(el,s,S.col[s.id]?'n':'s');
   el.onclick=function(){sfx('ui');showSpecies(s.id)};
  })(cards[i]);
 }
 var chips=v.querySelectorAll('.chip');
 for(var j=0;j<chips.length;j++)(function(el){el.onclick=function(){colFilter=parseInt(el.getAttribute('data-f'),10);renderCol()}})(chips[j]);
 var ms=v.querySelectorAll('[data-ms]');
 for(var k=0;k<ms.length;k++)(function(el){el.onclick=function(){
  var n=parseInt(el.getAttribute('data-ms'),10),m=MS.filter(function(x){return x.n===n})[0];
  if(!m||S.ms.indexOf(n)>=0||Object.keys(S.col).length<n)return;
  S.ms.push(n);S.coins+=m.c;S.st.earned+=m.c;save();updHud();sfx('coin');toast('Hadiah koleksi: +'+fmt(m.c)+' koin');renderCol();
 }})(ms[k]);
}
function showSpecies(id){
 var s=BY[id],c=S.col[id],col=RCOL[s.r];
 var spots=s.sp.map(function(i){return SPOTS[i].n}).join(', ');
 var h='<div style="color:'+col+';font-weight:bold;letter-spacing:2px">'+RAR[s.r]+'</div><canvas id="mc" class="big-sp" width="108" height="66"></canvas>';
 if(!c){
  h+='<div class="cname">???</div><div class="muted">Belum pernah ditangkap.</div><div class="kv" style="margin-top:8px"><span>Habitat</span><span>'+spots+'</span></div>';
 }else{
  h+='<div class="cname">'+s.n+'</div><div class="muted">'+s.d+'</div><div style="margin-top:8px">'+
  '<div class="kv"><span>Habitat</span><span>'+spots+'</span></div>'+
  '<div class="kv"><span>Kedalaman</span><span>'+s.dp.map(function(d){return Core.DEPTHN[d]}).join(', ')+'</span></div>'+
  '<div class="kv"><span>Waktu aktif</span><span>'+(s.t==='malam'?'malam hari':s.t==='siang'?'siang hari':'kapan saja')+'</span></div>'+
  '<div class="kv"><span>Ukuran</span><span>'+fw(s.g[0])+' - '+fw(s.g[1])+'</span></div>'+
  '<div class="kv"><span>Harga dasar</span><span>'+fmt(s.v)+' koin</span></div>'+
  '<div class="kv"><span>Tertangkap</span><span>'+c.n+' kali</span></div>'+
  '<div class="kv"><span>Terberat</span><span>'+fw(c.best)+'</span></div>'+
  '<div class="kv"><span>Varian emas</span><span>'+c.gold+'</span></div></div>';
 }
 h+='<button id="mok" class="btn ac" style="width:100%;margin-top:10px">TUTUP</button>';
 openModal(h,col);
 drawBig('mc',s,c?'n':'s');
 $('mok').onclick=function(){sfx('ui');closeModal()};
}
function bagSorted(){
 var arr=S.bag.map(function(it,i){return {it:it,i:i,v:Core.sellValue(BY[it.i],it.w,it.g)}});
 arr.sort(function(a,b){return b.v-a.v});
 return arr;
}
function renderBag(){
 var v=$('v-bag'),arr=bagSorted(),total=0;
 arr.forEach(function(a){total+=a.v});
 var h='<div class="panel"><h3>Tas ikan '+S.bag.length+'/'+S.cap+'</h3><div class="muted">Total nilai: '+fmt(total)+' koin</div><div class="chips">'+
  '<button class="btn sm ac" id="sellAll"'+(arr.length?'':' disabled')+'>JUAL SEMUA</button>'+
  '<button class="btn sm" id="sellCm"'+(arr.length?'':' disabled')+'>JUAL UMUM</button></div></div>';
 if(!arr.length)h+='<div class="panel muted">Tas kosong. Pergi memancing dulu.</div>';
 arr.forEach(function(a){
  var s=BY[a.it.i];
  h+='<div class="item" data-i="'+a.i+'" style="border-color:'+(a.it.g?'#ffd447':'#050a12')+'"><canvas width="36" height="22"></canvas><div class="inf"><b style="color:'+RCOL[s.r]+'">'+s.n+(a.it.g?' (EMAS)':'')+'</b><small>'+fw(a.it.w)+' | '+RAR[s.r]+'</small></div><button class="btn sm" data-sell="'+a.i+'">'+fmt(a.v)+'</button></div>';
 });
 v.innerHTML=h;
 var items=v.querySelectorAll('.item');
 for(var i=0;i<items.length;i++)(function(el){
  var it=S.bag[parseInt(el.getAttribute('data-i'),10)];
  if(it)miniCanvas(el,BY[it.i],it.g?'g':'n');
 })(items[i]);
 var sb=v.querySelectorAll('[data-sell]');
 for(var j=0;j<sb.length;j++)(function(el){el.onclick=function(){
  var idx=parseInt(el.getAttribute('data-sell'),10),it=S.bag[idx];if(!it)return;
  var val=Core.sellValue(BY[it.i],it.w,it.g);
  S.bag.splice(idx,1);S.coins+=val;S.st.earned+=val;save();updHud();sfx('coin');renderBag();
 }})(sb[j]);
 var sa=$('sellAll'),sc=$('sellCm');
 if(sa)sa.onclick=function(){sellMany(function(){return true})};
 if(sc)sc.onclick=function(){sellMany(function(it){return BY[it.i].r===0&&!it.g})};
}
function sellMany(fn){
 var keep=[],gain=0,n=0;
 S.bag.forEach(function(it){if(fn(it)){gain+=Core.sellValue(BY[it.i],it.w,it.g);n++}else keep.push(it)});
 if(!n){toast('Tidak ada ikan yang cocok.');return}
 S.bag=keep;S.coins+=gain;S.st.earned+=gain;save();updHud();sfx('coin');toast('Terjual '+n+' ikan: +'+fmt(gain)+' koin');renderBag();
}
function bagCost(){return Math.round(150*Math.pow(1.6,(S.cap-20)/10))}
function renderShop(){
 var v=$('v-shop'),h='';
 var nr=S.rod+1,r=ROD[nr];
 h+='<div class="panel"><h3>Joran</h3><div>Dipakai: <b>'+ROD[S.rod].n+'</b></div>';
 if(r){
  h+='<div class="muted" style="margin:4px 0">Berikutnya: '+r.n+' | zona '+Math.round(r.zone*100)+'% | keberuntungan +'+Math.round(r.luck*100)+'% | menunggu -'+Math.round(r.spd*100)+'% | waktu kait +'+Math.round(r.react*100)+'%</div>'+
   '<button class="btn ac" id="buyRod"'+(S.coins<r.cost||S.lv<r.lv?' disabled':'')+'>BELI '+fmt(r.cost)+' koin'+(S.lv<r.lv?' (Lv.'+r.lv+')':'')+'</button>';
 }else h+='<div class="muted">Joran sudah maksimal.</div>';
 h+='</div><div class="panel"><h3>Umpan</h3><div class="muted" style="margin-bottom:6px">Umpan khusus menaikkan peluang ikan langka dan mempercepat gigitan.</div>';
 ['udang','emas'].forEach(function(k){
  var b=BAIT[k];
  h+='<div class="kv" style="align-items:center"><span><b>'+b.n+'</b> (stok '+S.stock[k]+')<br><small class="muted">keberuntungan +'+Math.round(b.luck*100)+'%'+(b.gold?', peluang emas +'+Math.round(b.gold*100)+'%':'')+'</small></span><button class="btn sm" data-bait="'+k+'"'+(S.coins<b.price?' disabled':'')+'>'+b.pack+' pcs | '+fmt(b.price)+'</button></div>';
 });
 h+='</div><div class="panel"><h3>Kapasitas tas</h3><div class="muted" style="margin-bottom:6px">Sekarang '+S.cap+' slot (maks 80).</div>';
 if(S.cap<80)h+='<button class="btn" id="buyBag"'+(S.coins<bagCost()?' disabled':'')+'>+10 SLOT | '+fmt(bagCost())+' koin</button>';
 else h+='<div class="muted">Sudah maksimal.</div>';
 h+='</div>';
 v.innerHTML=h;
 var br=$('buyRod');
 if(br)br.onclick=function(){
  if(S.coins<r.cost||S.lv<r.lv)return;
  S.coins-=r.cost;S.rod=nr;save();updHud();syncUi();sfx('epic');toast(r.n+' dipakai!');renderShop();
 };
 var bb=v.querySelectorAll('[data-bait]');
 for(var i=0;i<bb.length;i++)(function(el){el.onclick=function(){
  var k=el.getAttribute('data-bait'),b=BAIT[k];if(S.coins<b.price)return;
  S.coins-=b.price;S.stock[k]+=b.pack;save();updHud();syncUi();sfx('coin');renderShop();
 }})(bb[i]);
 var bg=$('buyBag');
 if(bg)bg.onclick=function(){
  var c=bagCost();if(S.coins<c||S.cap>=80)return;
  S.coins-=c;S.cap+=10;save();updHud();sfx('coin');renderShop();
 };
}
function encode(){try{return btoa(unescape(encodeURIComponent(JSON.stringify(S))))}catch(e){return ''}}
function decode(s){try{return JSON.parse(decodeURIComponent(escape(atob(s.replace(/\s+/g,'')))))}catch(e){return null}}
var resetMark=0;
function renderData(){
 var v=$('v-data'),st=S.st;
 var h='<div class="panel"><h3>Statistik</h3>'+
 '<div class="kv"><span>Lemparan</span><span>'+fmt(st.casts)+'</span></div>'+
 '<div class="kv"><span>Ikan tertangkap</span><span>'+fmt(st.caught)+'</span></div>'+
 '<div class="kv"><span>Ikan lolos</span><span>'+fmt(st.lost)+'</span></div>'+
 '<div class="kv"><span>Varian emas</span><span>'+fmt(st.golden)+'</span></div>'+
 '<div class="kv"><span>Ikan terberat</span><span>'+(st.best?fw(st.best):'-')+'</span></div>'+
 '<div class="kv"><span>Total pendapatan jual</span><span>'+fmt(st.earned)+'</span></div></div>'+
 '<div class="panel"><h3>Pengaturan</h3><button class="btn" id="tSnd">Suara: '+(S.snd?'NYALA':'MATI')+'</button></div>'+
 '<div class="panel"><h3>Cadangan progres</h3><div class="muted" style="margin-bottom:6px">Progres disimpan di perangkat ini. Salin kode ini untuk memindahkan atau mencadangkan.</div>'+
 '<textarea id="code" readonly></textarea><div class="chips"><button class="btn sm" id="bCopy">SALIN</button></div>'+
 '<textarea id="imp" placeholder="Tempel kode cadangan di sini"></textarea><div class="chips"><button class="btn sm" id="bImp">MUAT KODE</button></div></div>'+
 '<div class="panel"><h3>Reset</h3><button class="btn" id="bReset">HAPUS SEMUA DATA</button></div>';
 v.innerHTML=h;
 $('code').value=encode();
 $('tSnd').onclick=function(){S.snd=!S.snd;save();renderData();sfx('ui')};
 $('bCopy').onclick=function(){
  var t=$('code');t.select();
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t.value)}else{document.execCommand('copy')}toast('Kode disalin')}catch(e){toast('Tekan lama lalu salin manual')}
 };
 $('bImp').onclick=function(){
  var o=decode($('imp').value);
  if(!o||typeof o!=='object'){toast('Kode tidak valid.');return}
  S=Core.sanitize(o);save();syncUi();initBg();toast('Progres dimuat.');renderData();
 };
 $('bReset').onclick=function(){
  var n=Date.now();
  if(n-resetMark>3500){resetMark=n;toast('Tekan sekali lagi dalam 3 detik untuk menghapus.');return}
  S=Core.defaults();save();syncUi();initBg();toast('Data direset.');renderData();
 };
}

/* ===== controls ===== */
function press(){
 if(G.modal)return;
 var p=G.phase;
 if(p==='idle')startPower();
 else if(p==='power')releaseCast();
 else if(p==='wait')cancelWait();
 else if(p==='bite')doHook();
 else if(p==='fight')G.holding=true;
}
function release(){G.holding=false}
function cycleSpot(d){
 if(G.phase!=='idle'){toast('Selesaikan dulu sesi memancing.');return}
 var n=SPOTS.length,i=S.spot,tries=0;
 do{i=(i+d+n)%n;tries++}while(SPOTS[i].lv>S.lv&&tries<=n);
 if(i===S.spot&&SPOTS.length>1){toast('Spot lain terbuka di Lv.'+SPOTS[(S.spot+1)%n].lv);return}
 S.spot=i;save();initBg();syncUi();sfx('ui');
}
function cycleBait(d){
 if(G.phase!=='idle'){toast('Selesaikan dulu sesi memancing.');return}
 var ks=['cacing','udang','emas'],i=ks.indexOf(S.bait);
 S.bait=ks[(i+d+ks.length)%ks.length];save();syncUi();sfx('ui');
}
var act=$('act');
act.addEventListener('pointerdown',function(e){e.preventDefault();press()});
act.addEventListener('pointerup',release);
act.addEventListener('pointerleave',release);
act.addEventListener('pointercancel',release);
cv.addEventListener('pointerdown',function(e){e.preventDefault();press()});
cv.addEventListener('pointerup',release);
window.addEventListener('pointerup',release);
document.addEventListener('keydown',function(e){if(e.code==='Space'&&!e.repeat){e.preventDefault();press()}});
document.addEventListener('keyup',function(e){if(e.code==='Space')release()});
$('spL').onclick=function(){cycleSpot(-1)};$('spR').onclick=function(){cycleSpot(1)};
$('bL').onclick=function(){cycleBait(-1)};$('bR').onclick=function(){cycleBait(1)};
(function(){
 var tb=document.querySelectorAll('#tabs button');
 for(var i=0;i<tb.length;i++)(function(el){el.onclick=function(){showView(el.getAttribute('data-v'))}})(tb[i]);
})();
$('modal').addEventListener('pointerdown',function(e){if(e.target===$('modal')&&G.phase!=='result')closeModal()});

/* ===== loop ===== */
function update(dt){
 var p=G.phase;
 G.tt+=dt;
 if(G.dip>0&&p!=='bite')G.dip=Math.max(0,G.dip-dt*2.6);
 if(p==='power'){
  G.pw+=G.pwd*dt/.75;
  if(G.pw>=1){G.pw=1;G.pwd=-1}
  if(G.pw<=0){G.pw=0;G.pwd=1}
 }else if(p==='cast'){
  G.t+=dt;
  if(!G.splashed&&G.t>=.55){
   G.splashed=true;splash(BX,SURF,8);sfx('splash');
   G.phase='wait';setupWait();
   setMsg('Menunggu gigitan...','Lihat pelampung. Jangan tarik sebelum ada tanda seru.');
   syncUi();
  }
 }else if(p==='wait'){
  G.t+=dt;
  while(G.nib.length&&G.t>=G.nib[0]){G.nib.shift();G.dip=.7;sfx('nibble')}
  if(G.t>=G.biteAt)startBite();
 }else if(p==='bite'){
  G.biteT+=dt;
  if(G.biteT>=G.biteWin)missBite();
 }else if(p==='fight'){
  var r=Core.fightStep(G.fs,dt,G.holding);
  if(r==='win')landed();
  else if(r==='lose')fightLost(G.fs.why);
 }
 for(var i=G.fx.length-1;i>=0;i--){
  var f=G.fx[i];f.l-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=90*dt;
  if(f.l<=0)G.fx.splice(i,1);
 }
}
var last=0,hudT=0;
function frame(now){
 var dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(!document.hidden){
  update(dt);
  if(curView==='fish')drawScene(now);
  hudT+=dt;if(hudT>1){hudT=0;updHud()}
 }
 requestAnimationFrame(frame);
}
cx.imageSmoothingEnabled=false;
initBg();msgIdle();syncUi();
requestAnimationFrame(function(t){last=t;frame(t)});
})();
</script>
</body></html>
`;

export async function handler(m, { sock }) {
  if (!m?.chat || !sock) return;

  const key = m?.raw?.key || m?.key;
  if (key) {
    await sock
      .sendMessage(m.chat, { react: { text: "🎣", key } })
      .catch(() => {});
  }

  const payload = Buffer.from(
    JSON.stringify({
      response_id: randomUUID(),
      sections: [
        {
          view_model: {
            primitive: {
              __typename: "GenAIaeacdsnwHtmlPrimitive",
              payload: GAME_HTML,
              trusted_sources: [],
            },
            __typename: "GenAISingleLayoutViewModel",
          },
        },
      ],
    }),
  ).toString("base64");

  try {
    await sock.relayMessage(
      m.chat,
      {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          botMetadata: {},
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [{ messageType: 2, messageText: "Pixel Fishing 🎣" }],
              unifiedResponse: { data: payload },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
                forwardOrigin: 4,
              },
            },
          },
        },
      },
      {},
    );
  } catch {
    await m
      .reply(
        "Game gagal dikirim. Versi WhatsApp atau Baileys kamu mungkin belum mendukung pesan interaktif ini.",
      )
      .catch(() => {});
  }
}
