"use strict";

const AI=1, OPP=-1;
const SCORE_WIN=1_000_000_000;
const TIMEOUT={timeout:true};
let ready=false, words=[], byFirst=new Map(), predicateSet=new Set(), baseCache=new Map();

function normalizeWord(raw){return String(raw||"").normalize("NFC").trim().replace(/[-‐‑‒–—―·ㆍ^\s]/g,"").replace(/[0-9０-９]+$/g,"");}
const CHO=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG=["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG=["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const N_TO_IEUNG=new Set(["ㅕ","ㅛ","ㅠ","ㅣ"]), R_TO_IEUNG=new Set(["ㅑ","ㅕ","ㅖ","ㅛ","ㅠ","ㅣ"]), R_TO_N=new Set(["ㅏ","ㅐ","ㅓ","ㅔ","ㅗ","ㅜ","ㅡ"]);
function isHangulSyllable(s){if(!s||s.length!==1)return false;const c=s.charCodeAt(0);return c>=0xAC00&&c<=0xD7A3;}
function decomposeSyllable(s){const x=s.charCodeAt(0)-0xAC00;return [CHO[Math.floor(x/(21*28))],JUNG[Math.floor((x%(21*28))/28)],JONG[x%28]];}
function composeSyllable(i,m,f){return String.fromCharCode(0xAC00+CHO.indexOf(i)*21*28+JUNG.indexOf(m)*28+JONG.indexOf(f));}
function applyDueum(s){if(!isHangulSyllable(s))return s;const [i,m,f]=decomposeSyllable(s);if(i==="ㄴ"&&N_TO_IEUNG.has(m))return composeSyllable("ㅇ",m,f);if(i==="ㄹ"&&R_TO_IEUNG.has(m))return composeSyllable("ㅇ",m,f);if(i==="ㄹ"&&R_TO_N.has(m))return composeSyllable("ㄴ",m,f);return s;}
function allowedStartSyllables(required){if(required==="렁")return ["렁","엉"];const changed=applyDueum(required);return changed===required?[required]:[required,changed];}
function baseMoves(required){const initials=allowedStartSyllables(required),key=initials.join("|");if(baseCache.has(key))return baseCache.get(key);const out=[];for(const s of initials){const a=byFirst.get(s);if(a)out.push(...a);}baseCache.set(key,out);return out;}
function legalMoves(required,used){return baseMoves(required).filter(w=>!used.has(w));}
function countLegalFast(required,usedFirst){let n=0;for(const s of allowedStartSyllables(required))n+=Math.max(0,(byFirst.get(s)?.length||0)-(usedFirst.get(s)||0));return n;}
function addUsed(word,used,usedFirst){used.add(word);usedFirst.set(word[0],(usedFirst.get(word[0])||0)+1);}
function removeUsed(word,used,usedFirst){used.delete(word);const n=(usedFirst.get(word[0])||1)-1;if(n<=0)usedFirst.delete(word[0]);else usedFirst.set(word[0],n);}
function buildUsedFirst(used){const m=new Map();for(const w of used)m.set(w[0],(m.get(w[0])||0)+1);return m;}
function isPredicate(w){return predicateSet.has(w);}
function preferNonPredicate(moves){const non=moves.filter(w=>!isPredicate(w));return non.length?non:moves;}
function logMobility(n){return Math.log1p(Math.max(0,n))*230;}
function squeeze(n){if(n===0)return 100000;if(n===1)return 13000;if(n<=3)return 5200;if(n<=7)return 2200;if(n<=15)return 900;if(n<=31)return 360;if(n<=63)return 120;return 0;}
function leafScore(required,usedFirst,side){const n=countLegalFast(required,usedFirst);if(n===0)return side===AI?-SCORE_WIN:SCORE_WIN;const m=logMobility(n)-squeeze(n);return side===AI?m:-m;}
function checkTime(ctx){ctx.nodes++;if((ctx.nodes&255)===0&&performance.now()>=ctx.deadline)throw TIMEOUT;}
function branchCap(ctx,depth,total,side){if(total<=10)return total;const expert=ctx.difficulty==="expert";if(side===OPP&&total<=16)return total;let cap;
  if(expert){cap=depth>=6?9:depth===5?11:depth===4?15:depth===3?22:34;}
  else{cap=depth>=5?7:depth===4?9:depth===3?13:20;}
  if(total<=cap+4)return total;return Math.min(total,cap);
}
function orderMoves(moves,used,usedFirst,side,pvWord=null){
  const ann=moves.map(w=>{addUsed(w,used,usedFirst);const next=countLegalFast(w.slice(-1),usedFirst);removeUsed(w,used,usedFirst);return {w,next,pred:isPredicate(w),last:w.slice(-1)};});
  ann.sort((a,b)=>{
    if(pvWord){if(a.w===pvWord&&b.w!==pvWord)return -1;if(b.w===pvWord&&a.w!==pvWord)return 1;}
    if(side===AI&&a.pred!==b.pred)return a.pred?1:-1;
    return (a.next-b.next)||(a.w.length-b.w.length)||a.w.localeCompare(b.w,"ko");
  });
  const buckets=new Map();for(const x of ann){let a=buckets.get(x.last);if(!a)buckets.set(x.last,a=[]);a.push(x);}
  const keys=[...buckets.keys()].sort((ka,kb)=>(buckets.get(ka)[0].next-buckets.get(kb)[0].next));
  const out=[];let layer=0,added=true;while(added){added=false;for(const k of keys){const x=buckets.get(k)[layer];if(x){out.push(x.w);added=true;}}layer++;}
  return out;
}
function childProofAtNode(side,childProof){return childProof;}
function searchNode(required,used,usedFirst,depth,side,alpha,beta,ctx,ply,pvHint){
  checkTime(ctx);
  let all=legalMoves(required,used);
  if(!all.length)return {score:side===AI?-SCORE_WIN+ply:SCORE_WIN-ply,proof:side===AI?"LOSS":"WIN",pv:[],complete:true};
  if(depth<=0)return {score:leafScore(required,usedFirst,side),proof:"UNKNOWN",pv:[],complete:false};
  if(side===AI)all=preferNonPredicate(all);
  const ordered=orderMoves(all,used,usedFirst,side,pvHint?.[0]||null),cap=branchCap(ctx,depth,ordered.length,side),moves=ordered.slice(0,cap);
  const allMovesExplored=cap===ordered.length;
  let bestScore=side===AI?-Infinity:Infinity,bestPv=[],sawUnknown=false,processed=0;
  let allWin=true,allLoss=true;
  for(const w of moves){
    checkTime(ctx);addUsed(w,used,usedFirst);
    const child=searchNode(w.slice(-1),used,usedFirst,depth-1,-side,alpha,beta,ctx,ply+1,pvHint&&pvHint[0]===w?pvHint.slice(1):null);
    removeUsed(w,used,usedFirst);processed++;
    if(child.proof!=="WIN")allWin=false;if(child.proof!=="LOSS")allLoss=false;if(child.proof==="UNKNOWN")sawUnknown=true;
    const score=child.score;
    if((side===AI&&score>bestScore)||(side===OPP&&score<bestScore)){bestScore=score;bestPv=[w,...child.pv];}
    if(side===AI){alpha=Math.max(alpha,bestScore);if(child.proof==="WIN")return {score:bestScore,proof:"WIN",pv:bestPv,complete:true};}
    else{beta=Math.min(beta,bestScore);if(child.proof==="LOSS")return {score:bestScore,proof:"LOSS",pv:bestPv,complete:true};}
    if(beta<=alpha)break;
  }
  const exploredAll=allMovesExplored&&processed===moves.length;
  let proof="UNKNOWN";
  if(exploredAll){if(side===AI&&allLoss)proof="LOSS";else if(side===OPP&&allWin)proof="WIN";}
  return {score:bestScore,proof,pv:bestPv,complete:exploredAll&&!sawUnknown};
}
function rootMoves(required,used,usedFirst,moveCount,rootCandidates){
  let moves=Array.isArray(rootCandidates)&&rootCandidates.length?rootCandidates.filter(w=>!used.has(w)&&allowedStartSyllables(required).includes(w[0])):legalMoves(required,used);
  if(moveCount===0)moves=moves.filter(w=>{addUsed(w,used,usedFirst);const n=countLegalFast(w.slice(-1),usedFirst);removeUsed(w,used,usedFirst);return n>0;});
  return preferNonPredicate(moves);
}
function rootCap(ctx,depth,total){if(total<=18)return total;if(ctx.difficulty==="expert")return Math.min(total,depth>=5?38:depth===4?52:72);return Math.min(total,depth>=4?24:36);}
function searchRoot(required,used,usedFirst,moveCount,depth,ctx,rootCandidates,pvHint){
  let all=rootMoves(required,used,usedFirst,moveCount,rootCandidates);if(!all.length)return {word:null,score:-SCORE_WIN,proof:"LOSS",pv:[],complete:true};
  const ordered=orderMoves(all,used,usedFirst,AI,pvHint?.[0]||null),cap=rootCap(ctx,depth,ordered.length),moves=ordered.slice(0,cap);
  let best=null,bestScore=-Infinity,bestPv=[],allLoss=true,processed=0;
  for(const w of moves){
    checkTime(ctx);addUsed(w,used,usedFirst);
    const child=searchNode(w.slice(-1),used,usedFirst,depth-1,OPP,-Infinity,Infinity,ctx,1,pvHint&&pvHint[0]===w?pvHint.slice(1):null);
    removeUsed(w,used,usedFirst);processed++;
    if(child.proof!=="LOSS")allLoss=false;
    let score=child.score;
    if(isPredicate(w))score-=250000; // 최후순 정책의 안전망
    if(score>bestScore){bestScore=score;best=w;bestPv=[w,...child.pv];}
    if(child.proof==="WIN")return {word:w,score,proof:"WIN",pv:[w,...child.pv],complete:true};
  }
  const exploredAll=cap===ordered.length&&processed===moves.length;
  return {word:best,score:bestScore,proof:exploredAll&&allLoss?"LOSS":"UNKNOWN",pv:bestPv,complete:exploredAll};
}
function searchClassic(msg){
  if(!ready)throw new Error("AI Worker가 아직 준비되지 않았습니다.");
  const searchStarted=performance.now(),used=new Set((msg.usedWords||[]).map(normalizeWord).filter(Boolean)),usedFirst=buildUsedFirst(used),budgetMs=Math.max(80,Number(msg.budgetMs||500));
  const ctx={deadline:searchStarted+budgetMs,difficulty:msg.difficulty==="expert"?"expert":"hard",nodes:0};
  const maxDepth=ctx.difficulty==="expert"?8:5,minDepth=2;let best=null,pvHint=null,completedDepth=0;
  for(let depth=minDepth;depth<=maxDepth;depth++){
    try{
      const result=searchRoot(msg.required,used,usedFirst,Number(msg.moveCount||0),depth,ctx,msg.rootCandidates||null,pvHint);
      if(result.word){best=result;pvHint=result.pv;completedDepth=depth;}
      if(result.proof==="WIN")break;
      if(performance.now()>=ctx.deadline)break;
    }catch(e){if(e===TIMEOUT)break;throw e;}
  }
  return {word:best?.word||null,kind:best?.proof==="WIN"?"PROVEN_WIN":"HEURISTIC",score:best?.score??null,pv:best?.pv||[],depth:completedDepth,nodes:ctx.nodes,elapsedMs:Math.round(performance.now()-searchStarted)};
}
function percentile(arr,p){if(!arr.length)return 0;const a=arr.slice().sort((x,y)=>x-y),i=Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*p)));return a[i];}
function evaluateOpening(word,used,usedFirst,ctx){
  checkTime(ctx);if(used.has(word))return -Infinity;addUsed(word,used,usedFirst);const replies=legalMoves(word.slice(-1),used),m=replies.length;if(m<1){removeUsed(word,used,usedFirst);return -Infinity;}
  const ordered=orderMoves(replies,used,usedFirst,OPP),sample=ordered.length<=72?ordered:ordered.filter((_,i)=>i<36||i%Math.ceil(ordered.length/36)===0).slice(0,72),next=[];
  for(const r of sample){checkTime(ctx);addUsed(r,used,usedFirst);next.push(countLegalFast(r.slice(-1),usedFirst));removeUsed(r,used,usedFirst);}
  removeUsed(word,used,usedFirst);
  const q20=percentile(next,.20),median=percentile(next,.50),dead=next.filter(n=>n===0).length,thin=next.filter(n=>n<=3).length;
  return Math.log1p(m)*260+Math.log1p(q20)*520+Math.log1p(median)*210-dead*22000-thin*1600-(isPredicate(word)?500000:0);
}
function selectOpening(msg){
  if(!ready)throw new Error("AI Worker가 아직 준비되지 않았습니다.");
  const used=new Set((msg.usedWords||[]).map(normalizeWord).filter(Boolean)),usedFirst=buildUsedFirst(used),ctx={deadline:performance.now()+Math.max(100,Number(msg.budgetMs||350)),difficulty:"hard",nodes:0};
  let best=[],bestScore=-Infinity;
  for(const word of msg.candidates||[]){
    try{const s=evaluateOpening(word,used,usedFirst,ctx);if(s>bestScore+1e-9){bestScore=s;best=[word];}else if(Math.abs(s-bestScore)<1e-9)best.push(word);}catch(e){if(e===TIMEOUT)break;throw e;}
  }
  return {word:best.length?best[Math.floor(Math.random()*best.length)]:null,score:bestScore,nodes:ctx.nodes};
}
async function init(msg){
  const started=performance.now(),version=encodeURIComponent(msg.version||"v5");
  const fetchText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${url} (${r.status})`);return r.text();};
  const wordText=await fetchText(msg.wordsUrl||`./db/words.txt?v=${version}`);
  let predText="";try{predText=await fetchText(msg.predicateUrl||`./db/predicate_words.txt?v=${version}`);}catch(_){try{predText=await fetchText(msg.fallbackPredicateUrl||`./db/opening_exclude_verbs.txt?v=${version}`);}catch(__){predText="";}}
  words=[...new Set(wordText.split(/\r?\n/).map(normalizeWord).filter(w=>w.length>=2&&/^[가-힣]+$/.test(w)))];byFirst=new Map();for(const w of words){let a=byFirst.get(w[0]);if(!a)byFirst.set(w[0],a=[]);a.push(w);}predicateSet=new Set(predText.split(/\r?\n/).map(normalizeWord).filter(Boolean));baseCache.clear();ready=true;
  return {wordCount:words.length,predicateCount:predicateSet.size,elapsedMs:Math.round(performance.now()-started)};
}
self.onmessage=async e=>{
  const msg=e.data||{},id=msg.id;
  try{
    if(msg.type==="init"){const data=await init(msg);self.postMessage({id,type:"ready",...data});return;}
    if(msg.type==="search"){const data=searchClassic(msg);self.postMessage({id,type:"result",...data});return;}
    if(msg.type==="opening"){const data=selectOpening(msg);self.postMessage({id,type:"openingResult",...data});return;}
  }catch(err){self.postMessage({id,type:"error",message:String(err?.message||err)});}
};
