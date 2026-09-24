import './style.css';
import {ensure,convert,cancelFF,caps} from './ffmpeg.ts';

const $=s=>document.querySelector(s),EXT='mp3 wav m4a aac ogg oga flac webm mp4 mov mkv m4v avi'.split(' '),VID='mp4 mov mkv m4v avi'.split(' ');
const PRE={boost:{hp:10,pr:0,th:0,ra:1},voice:{hp:90,pr:4,th:-26,ra:3},balance:{hp:10,pr:0,th:-32,ra:5}};
const S={cfg:{gain:6,preset:'boost',clip:true,mono:false,start:0,end:0},ab:'boost',job:0};
const fmt=b=>b>1e6?(b/1e6).toFixed(1)+' MB':Math.round(b/1e3)+' KB',dB=x=>x>0?20*Math.log10(x):-99,tick=()=>new Promise(r=>setTimeout(r)),tm=t=>(+t).toFixed(1);
function note(t,bad){const n=$('#note');n.textContent=t||'';n.hidden=!t;n.className='note'+(bad?' bad':'')}
const FMT={mp3:['libmp3lame'],m4a:['aac'],ogg:['libvorbis'],flac:['flac'],mp4:['libx264','aac'],webm:['libvpx','libopus']};
function fmtOpts(){const sel=$('#fm');[...sel.options].forEach(x=>{const miss=(FMT[x.value]||[]).some(c=>caps.size&&!caps.has(c)),v=x.dataset.v!==undefined&&!S.vid;x.disabled=v||miss||(S.noFF&&x.value!=='wav');x.title=v?'Needs a video file':x.disabled?'Not supported by this FFmpeg build':''});
 if(sel.selectedOptions[0]&&sel.selectedOptions[0].disabled)sel.value=[...sel.options].find(x=>!x.disabled).value}
function build(c,g){const M=(t)=>{const f=c.createBiquadFilter();f.type=t;return f},hp=M('highpass'),pr=M('peaking'),cp=c.createDynamicsCompressor(),gn=c.createGain(),lm=c.createDynamicsCompressor(),mo=c.createGain();
 pr.frequency.value=3200;lm.knee.value=0;lm.attack.value=.002;lm.release.value=.08;cp.knee.value=12;cp.attack.value=.01;cp.release.value=.25;
 mo.channelCountMode='explicit';mo.channelInterpretation='speakers';
 hp.connect(pr);pr.connect(cp);cp.connect(gn);gn.connect(lm);lm.connect(mo);const n={hp,pr,cp,gn,lm,mo};apply(n,g);return{input:hp,output:mo,n}}
function apply(n,g){const P=PRE[g.preset];n.hp.frequency.value=P.hp;n.pr.gain.value=P.pr;n.cp.threshold.value=P.th;n.cp.ratio.value=P.ra;
 n.gn.gain.value=10**(g.gain/20);n.lm.threshold.value=g.clip?-1:0;n.lm.ratio.value=g.clip?20:1;n.mo.channelCount=g.mono?1:2}
function route(){if(!S.src)return;S.src.disconnect();S.src.connect(S.ab==='orig'?S.an:S.chain.input);$('#abO').setAttribute('aria-pressed',S.ab==='orig');$('#abB').setAttribute('aria-pressed',S.ab!=='orig')}
function reset(){S.job++;cancelAnimationFrame(S.raf);if(S.el){S.el.pause();S.el.removeAttribute('src');S.el.load();S.el.remove()}
 [S.url,S.out].forEach(u=>u&&URL.revokeObjectURL(u));if(S.ctx)S.ctx.close().catch(()=>{});
 Object.assign(S,{el:0,url:0,out:0,ctx:0,src:0,an:0,chain:0,buf:null,f:null,peaks:null});
 $('#media').innerHTML='';$('#res').hidden=$('#prog').hidden=true;$('#cancel').hidden=true;$('#go').disabled=$('#auto').disabled=true;note('')}
function pick(f){if(!f)return;const ext=(f.name.split('.').pop()||'').toLowerCase(),ok=/^(audio|video)\//.test(f.type);
 if((!EXT.includes(ext)&&!ok)||(f.type&&!ok&&f.type!=='application/octet-stream'))return note(`“${f.name}” isn’t a supported audio or video file. Try MP3, WAV, M4A, AAC, OGG, FLAC, WEBM, MP4, MOV, MKV, M4V or AVI.`,1);
 load(f,ext)}
async function load(f,ext){reset();S.f=f;const vid=f.type?f.type.startsWith('video'):VID.includes(ext);
 S.vid=vid;$('#fm').value=vid?'mp4':'mp3';fmtOpts();ensure().then(fmtOpts).catch(()=>{S.noFF=1;fmtOpts();note('The FFmpeg engine couldn’t load, so only WAV export is available.',1)});
 S.url=URL.createObjectURL(f);const el=document.createElement(vid?'video':'audio');el.controls=el.playsInline=true;el.preload='metadata';el.src=S.url;S.el=el;$('#media').append(el);
 $('#up').hidden=true;$('#ed').hidden=false;$('#fname').textContent=f.name;$('#fmeta').textContent=`${fmt(f.size)} · ${vid?'video':'audio'}`;
 if(f.size>5e8)note('This file is over 500 MB. Processing may be slow or run out of browser memory.');
 el.onerror=()=>note('This format cannot be previewed directly in your browser, but BoostWave can still attempt to process it.');
 try{const c=S.ctx=new AudioContext();S.src=c.createMediaElementSource(el);S.an=c.createAnalyser();S.an.fftSize=1024;S.chain=build(c,S.cfg);S.chain.output.connect(S.an);S.an.connect(c.destination);route()}catch(e){note('Web Audio isn’t available in this browser.',1)}
 el.onplay=()=>{S.ctx&&S.ctx.resume();const g=S.cfg;if(g.end&&(el.currentTime<g.start-.05||el.currentTime>=g.end))el.currentTime=g.start};
 el.ontimeupdate=()=>{const g=S.cfg;if(g.end&&el.currentTime>=g.end){el.pause();el.currentTime=g.start}};
 loop();
 try{const b=await S.ctx.decodeAudioData(await f.arrayBuffer());if(S.f!==f)return;S.buf=b;Object.assign(S.cfg,{start:0,end:b.duration});$('#ts').value='0.0';$('#te').value=tm(b.duration);
  const N=800,step=Math.max(1,Math.floor(b.length/N/200)),d=b.getChannelData(0),p=[];
  for(let i=0;i<N;i++){let lo=0,hi=0;for(let j=Math.floor(i*b.length/N),e=Math.floor((i+1)*b.length/N);j<e;j+=step){const v=d[j];if(v<lo)lo=v;if(v>hi)hi=v}p.push([lo,hi])}
  S.peaks=p;$('#go').disabled=$('#auto').disabled=false}
 catch(e){if(S.f===f)note('Your browser couldn’t decode this file’s audio, so it can’t be boosted here. Try converting it to MP3, WAV or MP4 first.',1)}}
function stat(b,s,e){let pk=0,sq=0,n=0;const a=Math.floor(s*b.sampleRate),z=Math.floor(e*b.sampleRate);
 for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=a;i<z;i++){const v=Math.abs(d[i]);if(v>pk)pk=v;sq+=v*v;n++}}return{pk,rms:Math.sqrt(sq/Math.max(1,n))}}
function setGain(v){S.cfg.gain=v;$('#gain').value=v;$('#gv').textContent=(v>0?'+':'')+v+' dB';if(S.chain)apply(S.chain.n,S.cfg)}
let hold=0;
function loop(){S.raf=requestAnimationFrame(loop);const cs=getComputedStyle(document.documentElement),ac=cs.getPropertyValue('--ac'),mu=cs.getPropertyValue('--mut'),bad=cs.getPropertyValue('--bad');
 const W=$('#wave'),M=$('#meter'),dpr=devicePixelRatio||1;
 for(const c of[W,M]){const w=c.clientWidth*dpr,h=c.clientHeight*dpr;if(c.width!==w||c.height!==h){c.width=w;c.height=h}}
 let x=W.getContext('2d'),w=W.width,h=W.height,mid=h/2,g=10**(S.cfg.gain/20),dur=S.buf?S.buf.duration:0;x.clearRect(0,0,w,h);
 if(S.peaks){const bw=w/S.peaks.length;S.peaks.forEach(([lo,hi],i)=>{x.globalAlpha=.45;x.fillStyle=mu;x.fillRect(i*bw,mid-hi*mid,Math.max(1,bw),Math.max(1,(hi-lo)*mid));x.globalAlpha=1;
  const bh=Math.min(1,hi*g),bl=Math.max(-1,lo*g);x.fillStyle=(hi*g>1||lo*g<-1)&&!S.cfg.clip?bad:ac;x.fillRect(i*bw,mid-bh*mid,Math.max(1,bw),Math.max(1,(bh-bl)*mid))});
  x.fillStyle='rgba(128,128,128,.35)';x.fillRect(0,0,S.cfg.start/dur*w,h);x.fillRect(S.cfg.end/dur*w,0,w,h);
  x.fillStyle=cs.getPropertyValue('--fg');x.fillRect(S.el.currentTime/dur*w,0,2*dpr,h)}
 x=M.getContext('2d');x.clearRect(0,0,M.width,M.height);
 if(S.an){const d=new Float32Array(1024);S.an.getFloatTimeDomainData(d);let pk=0,sq=0;for(const v of d){pk=Math.max(pk,Math.abs(v));sq+=v*v}
  const f=v=>Math.max(0,(dB(v)+60)/60)*M.width;hold=Math.max(pk,hold*.97);x.fillStyle=pk>=.99?bad:ac;x.fillRect(0,0,f(Math.sqrt(sq/1024)),M.height);x.fillStyle=mu;x.fillRect(f(hold),0,3*dpr,M.height)}}
$('#wave').onclick=e=>{if(S.buf){const r=e.target.getBoundingClientRect();S.el.currentTime=(e.clientX-r.left)/r.width*S.buf.duration}};
$('#gain').oninput=e=>setGain(+e.target.value);
$('#pre').onclick=e=>{const p=e.target.dataset.p;if(!p)return;S.cfg.preset=p;document.querySelectorAll('#pre button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===p));if(S.chain)apply(S.chain.n,S.cfg)};
$('#clip').onchange=e=>{S.cfg.clip=e.target.checked;if(S.chain)apply(S.chain.n,S.cfg)};
$('#ch').onchange=e=>{S.cfg.mono=e.target.value==='1';if(S.chain)apply(S.chain.n,S.cfg)};
$('#abO').onclick=()=>{S.ab='orig';route()};$('#abB').onclick=()=>{S.ab='boost';route()};
$('#auto').onclick=()=>{const{pk,rms}=stat(S.buf,S.cfg.start,S.cfg.end);let g=-16-dB(rms);if(!S.cfg.clip)g=Math.min(g,-.5-dB(pk));setGain(Math.round(Math.max(0,Math.min(24,g))*2)/2)};
const trim=()=>{const d=S.buf?S.buf.duration:0;let s=Math.max(0,+$('#ts').value||0),e=Math.min(d,+$('#te').value||d);if(e-s<.1){s=0;e=d;note('End must be after start, so trim was reset.',1)}else note('');S.cfg.start=s;S.cfg.end=e;$('#ts').value=tm(s);$('#te').value=tm(e)};
$('#ts').onchange=$('#te').onchange=trim;
$('#setS').onclick=()=>{$('#ts').value=S.el.currentTime;trim()};$('#setE').onclick=()=>{$('#te').value=S.el.currentTime;trim()};
$('#rst').onclick=()=>{$('#ts').value=0;$('#te').value=S.buf?S.buf.duration:0;trim()};
const up=$('#up'),fi=$('#file');
up.onclick=()=>fi.click();up.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click()}};
$('#pickBtn').onclick=e=>{e.stopPropagation();fi.click()};$('#replace').onclick=()=>fi.click();
fi.onchange=()=>{pick(fi.files[0]);fi.value=''};
['dragenter','dragover'].forEach(t=>addEventListener(t,e=>{e.preventDefault();up.classList.add('drag')}));
['dragleave','drop'].forEach(t=>addEventListener(t,e=>{e.preventDefault();up.classList.remove('drag')}));
addEventListener('drop',e=>pick(e.dataTransfer.files[0]));
$('#remove').onclick=()=>{reset();$('#ed').hidden=true;$('#up').hidden=false};
addEventListener('pagehide',()=>{[S.url,S.out].forEach(u=>u&&URL.revokeObjectURL(u))});
function setPg(p,l){$('#pg').value=p;$('#pt').textContent=`${l} ${Math.round(p*100)}%`}
async function encode(o,f,kbps,scale,prog){const ch=o.numberOfChannels,n=o.length,sr=o.sampleRate,D=[...Array(ch)].map((_,i)=>o.getChannelData(i)),q=x=>{const v=Math.max(-1,Math.min(1,x*scale));return v<0?v*32768:v*32767};
 if(f==='wav'){const B=new ArrayBuffer(44+n*ch*2),v=new DataView(B),w=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
  w(0,'RIFF');v.setUint32(4,36+n*ch*2,1);w(8,'WAVEfmt ');v.setUint32(16,16,1);v.setUint16(20,1,1);v.setUint16(22,ch,1);v.setUint32(24,sr,1);v.setUint32(28,sr*ch*2,1);v.setUint16(32,ch*2,1);v.setUint16(34,16,1);w(36,'data');v.setUint32(40,n*ch*2,1);
  let p=44;for(let i=0;i<n;i++){for(let c=0;c<ch;c++){v.setInt16(p,q(D[c][i]),1);p+=2}if(i%262144===0)await prog(i/n)}return new Blob([B],{type:'audio/wav'})}
}
$('#go').onclick=async()=>{const b=S.buf,g={...S.cfg},job=++S.job,f=$('#fm').value,label=f==='mp3'?'Encoding MP3':'Writing WAV';
 const chk=()=>{if(job!==S.job)throw'cancel'};let stage='Rendering';const prog=async(p,l)=>{chk();setPg(p,l||stage);await tick()};
 $('#go').disabled=true;$('#cancel').hidden=false;$('#prog').hidden=false;$('#res').hidden=true;note('');setPg(0,'Rendering');
 try{const sr=b.sampleRate,ch=g.mono?1:Math.min(2,b.numberOfChannels),dur=g.end-g.start,len=Math.ceil(dur*sr),off=new OfflineAudioContext(ch,len,sr),src=off.createBufferSource(),chain=build(off,g);
  chain.n.mo.channelCount=ch;src.buffer=b;src.connect(chain.input);chain.output.connect(off.destination);src.start(0,g.start,dur);
  for(let i=1;i<12;i++){const t=Math.floor(len*i/12/128)*128/sr;if(t>0)off.suspend(t).then(async()=>{try{await prog(.5*i/12)}catch(e){}off.resume()}).catch(()=>{})}
  const o=await off.startRendering();chk();let pk=0;for(let c=0;c<o.numberOfChannels;c++)for(const v of o.getChannelData(c)){const a=Math.abs(v);if(a>pk)pk=a}
  const scale=g.clip&&pk>.97?.97/pk:1;stage=label;
  let blob=await encode(o,'wav',0,scale,p=>prog(.5+.1*p,'Preparing audio'));chk();
  if(f!=='wav'){await prog(.6,'Loading encoder');await ensure();chk();blob=await convert(blob,S.vid?S.f:null,f,+$('#kb').value,{start:g.start,dur,full:g.start===0&&g.end>=b.duration-.05},p=>{if(job===S.job)setPg(.6+.4*p,'Encoding')});chk()}
  if(S.out)URL.revokeObjectURL(S.out);S.out=URL.createObjectURL(blob);const before=stat(b,g.start,g.end).pk,base=S.f.name.replace(/\.[^.]+$/,'');
  const dl=$('#dl');dl.href=S.out;dl.download=`${base}-boosted.${f}`;
  $('#rs').textContent=`${dl.download} · ${fmt(blob.size)} · peak ${dB(before).toFixed(1)} → ${dB(pk*scale).toFixed(1)} dBFS`;$('#res').hidden=false;setPg(1,'Done')}
 catch(e){if(e==='cancel')setPg(0,'Cancelled');else{$('#prog').hidden=true;note(e&&e.message?e.message:'Export failed. Try WAV, or a shorter trim.',1)}}
 finally{if(job===S.job||true){$('#go').disabled=!S.buf;$('#cancel').hidden=true}}};
$('#cancel').onclick=()=>{S.job++;cancelFF();$('#pt').textContent='Cancelled';$('#go').disabled=false;$('#cancel').hidden=true};

const AC=import.meta.env.VITE_ADSENSE_CLIENT,AS=import.meta.env.VITE_ADSENSE_SLOT;
if(AC&&AS){const s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+AC;document.head.append(s);
 const a=$('#ad');a.hidden=false;a.innerHTML=`<ins class="adsbygoogle" style="display:block" data-ad-client="${AC}" data-ad-slot="${AS}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;(window.adsbygoogle=window.adsbygoogle||[]).push({})}
