<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,shallowRef,nextTick} from 'vue';
import {parisDate,dateIndex,dragonFor,countdown,parisNextMidnight,previousDate} from './data/daily';
import {art,sprite,TYPE_FR,teamFor,bossFor,type TeamMon} from './data/teams';
import {DailyBattle,type ViewState,type Outcome,type MonView,type BattleFrame} from './engine/showdown';
import {readDaily,writeDaily,readStats,writeStats,recordResult,wipeStorage} from './lib/storage';
import {moveCard} from './data/moves';
import {frameDuration,type PlaybackSpeed} from './lib/presentation';
import {visibleActiveSlot,activeSpecies,requestTeamIndex} from './lib/active';
import {planSwitch,type SwitchPlan} from './lib/switchVisual';
import {IllusionPresentation} from './lib/illusionView';
import PokemonSprite from './components/PokemonSprite.vue';

type Screen = 'home' | 'challenge' | 'team' | 'stats';
const screen=ref<Screen>('home');
const key=ref(parisDate());
const now=ref(new Date());
const daily=ref(readDaily(key.value));
const stats=ref(readStats());
const team=computed(()=>teamFor(key.value));
const enemy=computed(()=>bossFor(key.value));
const dragon=computed(()=>dragonFor(key.value));
const number=computed(()=>String(dateIndex(key.value)+1).padStart(4,'0'));
const dateLabel=computed(()=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'long',year:'numeric'}).format(now.value));
const timeLeft=computed(()=>countdown(parisNextMidnight(key.value)-now.value.getTime()));
const rate=computed(()=>stats.value.played?Math.round(stats.value.wins/stats.value.played*100)+'%':'—');
const streak=computed(()=>(stats.value.lastWin===key.value||stats.value.lastWin===previousDate(key.value))?stats.value.streak:0);
const view=shallowRef<ViewState|null>(null);
// L'ordre du simulateur doit être réactif : une variable `let battle` ne déclenche pas Vue.
const battleOrder=shallowRef<number[]|null>(null);
const live=shallowRef<ViewState|null>(null);
const frame=shallowRef<BattleFrame|null>(null);
type SwitchVisual = SwitchPlan & {phase:'recall'|'send'; ms:number};
const switchVisual=shallowRef<SwitchVisual|null>(null);
const playing=ref(false);
const restoring=ref(false);
const inPractice=ref(false);
const running=ref(false);
const switchMode=ref(false);
const selectedMove=ref(0);
const expandedMove=ref(false);
const showGuide=ref(false);
const showIntel=ref(false);
const speed=ref<PlaybackSpeed>('normal');
const speedModes: PlaybackSpeed[]=['cinematic','normal','fast'];
const notice=ref('');
let battle:DailyBattle|null=null;
let illusion=new IllusionPresentation();
let timeline:BattleFrame[]=[];
let sequence=0;
let tickHandle:number|undefined,noticeTimer:number|undefined,restoreTimer:number|undefined;

const allySlot=computed(()=>view.value?visibleActiveSlot(view.value.allies,view.value.allyActive):null);
const foeSlot=computed(()=>view.value?visibleActiveSlot(view.value.foes,view.value.foeActive):null);
const ally=computed(()=>allySlot.value===null?null:view.value?.allies[allySlot.value]??null);
const foe=computed(()=>foeSlot.value===null?null:view.value?.foes[foeSlot.value]??null);
// SOURCE DE VÉRITÉ : le Pokémon actif est identifié par le moteur de combat.
// L'ordre d'équipe (et l'ordre du banc) ne doit JAMAIS décider du sprite de l'arène.
// Lorsqu'aucun combat n'existe, on affiche le leader choisi dans Mon équipe.
const allySpec=computed(()=>activeSpecies(team.value,ally.value,daily.value.lead));
const foeSpec=computed(()=>activeSpecies(enemy.value,foe.value,0));
const field=computed(()=>view.value?.field??{weather:null,global:[],ally:[],foe:[]});
const ongoing=computed(()=>running.value && !view.value?.outcome);
const waiting=computed(()=>playing.value||restoring.value||!!timeline.length);
const canChoose=computed(()=>!waiting.value&&!!view.value?.request&&!view.value.busy&&!view.value.outcome&&!view.value.request.wait&&!view.value.request.teamPreview);
const mustSwitch=computed(()=>!!view.value?.request?.forceSwitch?.some(Boolean));
const moves=computed(()=>view.value?.request?.active?.[0]?.moves??[]);
const moveInfo=computed(()=>{const m=moves.value[selectedMove.value];return m?moveCard(m.id||m.move,foeSpec.value?.species):null;});
const switches=computed(()=>{const req=view.value?.request;if(!req?.side)return [];
  return req.side.pokemon.map((p,i)=>{const mon=team.value[requestTeamIndex(p,team.value)]??team.value[0];
    return {index:i,mon,active:p.active,condition:p.condition,disabled:p.active||/^0(?:\/|\s)/.test(p.condition)||(!!req.active?.[0]?.trapped&&!mustSwitch.value)};
  });
});
const history=computed(()=>view.value?.logs.slice(-14).reverse()||[]);
const labelForResult=computed(()=>({win:'VICTOIRE',loss:'DÉFAITE',draw:'MATCH NUL'})[view.value?.outcome||daily.value.result||'loss']);
const displayMessage=computed(()=>frame.value?.message || (restoring.value?'Reprise de votre combat…':!running.value?'Choisissez votre Pokémon de tête avant de commencer.':view.value?.outcome?'Combat terminé.':'À vous de jouer.'));
const canStartOfficial=computed(()=>!daily.value.result);
const fieldCount=computed(()=>Number(!!field.value.weather)+field.value.global.length+field.value.ally.length+field.value.foe.length);
const posForTeam=(index:number)=>battleOrder.value?.indexOf(index)??index;
const teamStatus=(index:number):MonView|null=>view.value?.allies[posForTeam(index)]??null;
const hpPct=(p:MonView|null)=>p?.maxHp?Math.max(0,Math.min(100,Math.round(p.hp/p.maxHp*100))):100;
const hpTint=(p:MonView|null)=>hpPct(p)>50?'good':hpPct(p)>20?'warning':'danger';
const typeLabel=(type:string)=>TYPE_FR[type]??type;
function changeScreen(value:Screen):void {screen.value=value;window.scrollTo({top:0,behavior:'auto'});}
function setSpeed(value:PlaybackSpeed):void {speed.value=value;localStorage.setItem('daily-n-animation-speed',value);}
function toast(msg:string):void {notice.value=msg;if(noticeTimer)clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>notice.value='',3300);}
function imageFailed(e:Event,id:number):void {const el=e.target as HTMLImageElement;if(el.dataset.fallback)return;el.dataset.fallback='yes';el.src=art(id);}
function resetTimeline():void {sequence++;timeline=[];playing.value=false;frame.value=null;switchVisual.value=null;restoring.value=false;if(restoreTimer)clearTimeout(restoreTimer);}
function pause(ms:number):Promise<void>{return new Promise(resolve=>window.setTimeout(resolve,ms));}
async function runTimeline():Promise<void> {
  if(playing.value)return;
  playing.value=true;
  const version=sequence;
  while(timeline.length && version===sequence) {
    const next=timeline.shift()!;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const plan=reduced?null:planSwitch(view.value,next);
    const duration=reduced && (next.kind==='switch'||next.kind==='drag')?60:frameDuration(next.kind,speed.value);
    frame.value=plan?.from?{...next,message:`${plan.from.label} revient dans sa Poké Ball.`}:next;
    if(plan) {
      // Garder l'ancien sprite pendant le rappel ; le nouveau n'apparaît qu'à l'ouverture de la seconde Ball.
      if(plan.from) {
        const recallMs=Math.round(duration*.42);
        switchVisual.value={...plan,phase:'recall',ms:recallMs};
        await pause(recallMs);
        if(version!==sequence)return;
      }
      const sendMs=duration-(plan.from?Math.round(duration*.42):0);
      view.value=next.state;
      frame.value=next;
      switchVisual.value={...plan,phase:'send',ms:sendMs};
      await pause(sendMs);
      if(version!==sequence)return;
      switchVisual.value=null;
    } else {
      view.value=next.state;
      await pause(duration);
    }
  }
  if(version!==sequence)return;
  playing.value=false;
  frame.value=null;
  if(live.value)view.value=live.value;
}
function onEvent(next:BattleFrame):void {const corrected=illusion.frame(next);if(restoring.value)return;timeline.push(corrected);void runTimeline();}
function onState(next:ViewState):void {
  const corrected=illusion.state(next);
  live.value=corrected;
  if(!playing.value&&!timeline.length&&!restoring.value)view.value=corrected;
  if(restoring.value && !battle?.isReplaying && next.request && !next.busy && !next.request.wait) {
    if(restoreTimer)clearTimeout(restoreTimer);
    restoreTimer=window.setTimeout(()=>{restoring.value=false;if(live.value)view.value=live.value;},130);
  }
  if(next.error) {resetTimeline();view.value=corrected;toast('Erreur pendant le combat.');}
  if(!inPractice.value&&daily.value.locked&&!daily.value.result&&battle&&battle.actions.length>daily.value.choices.length) {
    daily.value.choices=battle.actions;writeDaily(daily.value);
  }
}
function onEnd(result:Outcome):void {
  if(restoring.value){restoring.value=false;if(restoreTimer)clearTimeout(restoreTimer);}
  if(inPractice.value)return;
  if(daily.value.result)return;
  daily.value.result=result;daily.value.choices=battle?.actions||daily.value.choices;writeDaily(daily.value);
  stats.value=recordResult(stats.value,key.value,result);writeStats(stats.value);
}
async function start(practice=false):Promise<void> {
  if(!practice&&daily.value.result){toast('La tentative officielle est déjà terminée.');return;}
  if(battle)battle.destroy();battle=null;battleOrder.value=null;resetTimeline();illusion=new IllusionPresentation();
  view.value=null;live.value=null;selectedMove.value=0;expandedMove.value=false;switchMode.value=false;
  inPractice.value=practice;running.value=true;changeScreen('challenge');
  restoring.value=!practice&&daily.value.choices.length>0;
  if(!practice&&!daily.value.locked){daily.value.locked=true;daily.value.choices=[];writeDaily(daily.value);}
  const instance=new DailyBattle({key:key.value,lead:daily.value.lead,isPractice:practice,
    replay:practice?[]:daily.value.choices,onState,onEnd,onEvent});
  battle=instance;
  battleOrder.value=instance.teamOrder;
  await nextTick();
  await instance.start();
}
function goToChallenge():void {changeScreen('challenge');}
function chooseMove(index:number):void {const m=moves.value[index];if(!battle||!canChoose.value||!m||m.disabled||m.pp<=0)return;if(!battle.choose(`move ${index+1}`))toast('Cette attaque est indisponible.');expandedMove.value=false;}
function chooseSwitch(index:number):void {if(!battle||!canChoose.value||switches.value[index]?.disabled)return;if(battle.choose(`switch ${index+1}`))switchMode.value=false;else toast('Changement impossible.');}
function pickLead(index:number):void {if(daily.value.locked||ongoing.value)return;daily.value.lead=index;writeDaily(daily.value);}
function openMoveInfo(index:number):void {selectedMove.value=index;expandedMove.value=true;}
function refreshDay():void {const next=parisDate();if(next===key.value)return;battle?.destroy();battle=null;battleOrder.value=null;resetTimeline();running.value=false;view.value=null;live.value=null;inPractice.value=false;key.value=next;daily.value=readDaily(next);stats.value=readStats();changeScreen('home');toast('Nouveau défi disponible !');}
function tick():void {now.value=new Date();refreshDay();}
function reset():void {if(!window.confirm('Effacer les sauvegardes et statistiques locales de Daily N ?'))return;battle?.destroy();battle=null;battleOrder.value=null;resetTimeline();running.value=false;view.value=null;live.value=null;wipeStorage();daily.value=readDaily(key.value);stats.value=readStats();changeScreen('home');toast('Données effacées.');}
async function share():Promise<void> {const result=daily.value.result;const survivors=view.value&&!inPractice.value?view.value.allies.filter(m=>!m.fainted).length:null;
  const text=`DAILY N #${number.value}\nN · ${dragon.value}\n${result==='win'?'VICTOIRE':result==='loss'?'DÉFAITE':result==='draw'?'NUL':'NON JOUÉ'}\n${survivors===null?'□□□□□□':'🟩'.repeat(survivors)+'⬛'.repeat(6-survivors)}\n#DailyN`;
  try{await navigator.clipboard.writeText(text);toast('Résultat copié !');}catch{toast('Impossible de copier sur cet appareil.');}
}
onMounted(()=>{const v=localStorage.getItem('daily-n-animation-speed');if(v==='cinematic'||v==='normal'||v==='fast')speed.value=v;tickHandle=window.setInterval(tick,1000);if(daily.value.locked&&!daily.value.result){void start(false);}});
onUnmounted(()=>{resetTimeline();battle?.destroy();if(tickHandle)clearInterval(tickHandle);if(noticeTimer)clearTimeout(noticeTimer);});
</script>

<template>
<div class="app" :class="dragon==='Zekrom'?'theme-zekrom':'theme-reshiram'">
  <header class="topbar">
    <button class="logo" @click="changeScreen('home')" aria-label="Accueil Daily N"><span class="logo-mark">N</span><span class="logo-name">DAILY <b>N</b><small>UNYS</small></span></button>
    <nav class="nav" aria-label="Navigation principale">
      <button :class="{current:screen==='home'}" @click="changeScreen('home')">Accueil</button>
      <button :class="{current:screen==='challenge'}" @click="goToChallenge">Le défi</button>
      <button :class="{current:screen==='team'}" @click="changeScreen('team')">Mon équipe</button>
      <button :class="{current:screen==='stats'}" @click="changeScreen('stats')">Statistiques</button>
    </nav>
  </header>

  <main class="main-wrap">
    <section v-if="screen==='home'" class="home-view" aria-label="Accueil">
      <div class="home-main"><div class="home-copy"><span class="overline"><span class="live-dot"/> LE DÉFI DU {{dateLabel.toUpperCase()}}</span><h1>UN ROI.<br><span>SIX POKÉMON.</span><br>UN COMBAT.</h1><p>Chaque jour, une équipe. Face à vous : <strong>N</strong>, et son dragon légendaire. Un seul essai officiel.</p><div class="home-buttons"><button class="btn-primary" @click="canStartOfficial?start(false):changeScreen('challenge')">{{daily.result?'VOIR MON RÉSULTAT':daily.locked?'REPRENDRE LE COMBAT':'AFFRONTER N'}} <span>↗</span></button><button class="btn-outline" @click="changeScreen('team')">VOIR MON ÉQUIPE →</button></div><div class="home-facts"><div><small>DRAGON DU JOUR</small><b>{{dragon}}</b></div><div><small>PROCHAIN DÉFI</small><b>{{timeLeft}}</b></div></div></div>
        <div class="hero-visual"><div class="hero-visual-architecture"><span/><span/><span/></div><span class="vertical-decor">CHÂTEAU DE N // UNYS</span><div class="hero-ring"/><span class="hero-monogram">N</span><img :src="art(dragon==='Zekrom'?644:643)" :alt="dragon" class="hero-pokemon"/><div class="hero-bottom"><span>ADVERSAIRE DU JOUR</span><strong>{{dragon.toUpperCase()}}</strong><small>{{dragon==='Zekrom'?'DRAGON · ÉLECTRIK':'DRAGON · FEU'}}</small></div></div>
      </div><div class="home-bottom"><button @click="showGuide=true">COMMENT JOUER ? ↗</button></div>
    </section>

    <section v-else-if="screen==='challenge'" class="challenge-view" :class="{'past-result':!running&&!!daily.result}" aria-label="Le défi">
      <div class="page-bar"><div><h1>Le duel <em>contre N.</em></h1><p>{{inPractice?'Entraînement · sans incidence sur votre résultat':'Défi #'+number+' · '+dragon}}</p></div><div class="page-bar-actions"><button class="ghost-btn" @click="changeScreen('team')">MON ÉQUIPE</button><button class="ghost-btn" aria-label="Règles du jeu" @click="showGuide=true">?</button></div></div>
      <div class="combat-layout"><div class="combat-main"><div class="battle-topline"><div><span class="live-dot"/> {{(!running&&daily.result)||view?.outcome?'DUEL TERMINÉ':!running?'PRÊT À COMBATTRE':inPractice?'ENTRAÎNEMENT':'DÉFI OFFICIEL'}}</div><div v-if="running||!daily.result" class="battle-progress"><span>TOUR {{view?.turn||'—'}}</span><div class="foe-counter" :aria-label="'Pokémon de N encore en combat : '+(view?.foes.filter(mon=>!mon.fainted).length??6)+' sur 6'"><span v-for="(mon,i) in enemy" :key="mon.id" :class="{down:view?.foes[i]?.fainted}" :title="mon.label" aria-hidden="true"/></div></div><button v-if="running||!daily.result" class="intel-toggle" :aria-expanded="showIntel" @click="showIntel=!showIntel">{{showIntel?'MASQUER':'INFOS + JOURNAL'}}</button></div>
        <div v-if="running||!daily.result" class="arena" :style="{'--switch-ms':(switchVisual?.ms??0)+'ms'}" :class="{'ally-striking':frame?.kind==='move'&&frame.actor==='p1','enemy-striking':frame?.kind==='move'&&frame.actor==='p2','ally-hurt':['-damage','faint'].includes(frame?.kind||'')&&frame?.actor==='p1','enemy-hurt':['-damage','faint'].includes(frame?.kind||'')&&frame?.actor==='p2'}">
          <div class="castle-back"><span class="castle-pillar pillar-one"/><span class="castle-pillar pillar-two"/><span class="castle-pillar pillar-three"/><span class="castle-window"/><span class="castle-light"/></div><div class="arena-floor"/><span class="stage-label">PALAIS DE N</span>
          <div class="fighter foe-fighter"><div class="battle-status"><div class="battle-status-line"><b>{{foeSpec.label}}</b><span>NV.100</span></div><div class="hp-meter"><span class="hp-label">PV</span><div class="hp-rail" :class="hpTint(foe)" role="progressbar" :aria-label="'PV de '+foeSpec.label" :aria-valuenow="hpPct(foe)" aria-valuemin="0" aria-valuemax="100"><span class="hp-progress" :style="{width:hpPct(foe)+'%'}"/></div></div><div class="hp-fraction"><span>{{hpPct(foe)}}%</span></div></div><div class="fighter-ground"/><PokemonSprite :key="'foe-'+foeSpec.id" :id="foeSpec.id" :label="foeSpec.label" class="combat-sprite foe-sprite" :class="{recalling:switchVisual?.actor==='p2'&&switchVisual.phase==='recall',materializing:switchVisual?.actor==='p2'&&switchVisual.phase==='send'}"/></div>
          <div class="fighter ally-fighter"><div class="fighter-ground"/><PokemonSprite :key="'ally-'+allySpec.id" :id="allySpec.id" :label="allySpec.label" back class="combat-sprite ally-sprite" :class="{recalling:switchVisual?.actor==='p1'&&switchVisual.phase==='recall',materializing:switchVisual?.actor==='p1'&&switchVisual.phase==='send'}"/><div class="battle-status"><div class="battle-status-line"><b>{{allySpec.label}}</b><span>NV.100</span></div><div class="hp-meter"><span class="hp-label">PV</span><div class="hp-rail" :class="hpTint(ally)" role="progressbar" :aria-label="'PV de '+allySpec.label" :aria-valuenow="hpPct(ally)" aria-valuemin="0" aria-valuemax="100"><span class="hp-progress" :style="{width:hpPct(ally)+'%'}"/></div></div><div class="hp-fraction"><span>{{ally?`${ally.hp} / ${ally.maxHp}`:'— / —'}}</span></div></div></div>
          <div v-if="switchVisual" :key="switchVisual.actor+'-'+switchVisual.phase" class="switch-effect" :class="[switchVisual.actor,switchVisual.phase]" :style="{'--switch-ms':switchVisual.ms+'ms'}" aria-hidden="true"><span class="switch-beam"/><span class="pokeball"><i class="ball-top"/><i class="ball-bottom"/><i class="ball-button"/></span></div>
        </div>
        <div v-if="running||!daily.result" class="battle-message"><span class="message-icon">✦</span><strong :key="frame?.message||displayMessage">{{displayMessage}}</strong><div class="speed-picker"><button v-for="s in speedModes" :key="s" :class="{active:speed===s}" @click="setSpeed(s)" :aria-label="'Vitesse '+s">{{s==='cinematic'?'LENT':s==='normal'?'NORMAL':'RAPIDE'}}</button></div></div>
        <div v-if="running||!daily.result" class="team-bench"><div class="bench-title"><span>VOTRE ÉQUIPE</span><button @click="changeScreen('team')">DÉTAILS ↗</button></div><div class="bench-grid"><div v-for="(mon,i) in team" :key="mon.id" class="bench-mon" :class="{active:teamStatus(i)?.active||(!running&&daily.lead===i),fainted:teamStatus(i)?.fainted}" :title="mon.label"><img :key="'bench-'+mon.id" :src="sprite(mon.id)" :alt="mon.label" @error="imageFailed($event,mon.id)"/><span>{{mon.label}}</span><div class="mini-hp"><i :style="{width:hpPct(teamStatus(i))+'%'}"/></div></div></div></div>
        <div class="controls"><template v-if="view?.error"><div class="error"><b>Le simulateur a rencontré une erreur</b><span>{{view.error}}</span><button class="btn-primary" @click="start(inPractice)">RÉESSAYER ↗</button></div></template>
          <template v-else-if="!running&&daily.result"><div class="result-panel"><div><span>VOTRE DÉFI DU JOUR</span><h2 :class="daily.result==='win'?'won':'lost'">{{labelForResult}}</h2></div><div v-if="daily.result==='win'" class="n-epilogue"><img :src="'./assets/n-trainer.png'" alt="N, dresseur du Palais"/><div><small>N</small><blockquote>« Tu as su écouter tes Pokémon. Même ma vérité doit encore grandir. »</blockquote></div></div><div class="control-buttons"><button class="btn-primary" @click="start(true)">S'ENTRAÎNER ↗</button><button class="btn-outline" @click="changeScreen('stats')">STATISTIQUES</button></div></div></template>
          <template v-else-if="!running"><div class="control-message">Choisissez votre Pokémon de départ dans <button @click="changeScreen('team')">Mon équipe</button>.</div><div class="control-buttons"><button class="btn-primary" :disabled="!canStartOfficial" @click="start(false)">COMMENCER LE DÉFI ↗</button><button class="btn-outline" @click="start(true)">ENTRAÎNEMENT</button></div></template>
          <template v-else-if="view?.outcome"><div class="result-panel"><div><span>FIN DU COMBAT</span><h2 :class="view.outcome==='win'?'won':'lost'">{{labelForResult}}</h2></div><div v-if="view.outcome==='win'" class="n-epilogue"><img :src="'./assets/n-trainer.png'" alt="N, dresseur du Palais"/><div><small>N</small><blockquote>« Tu as su écouter tes Pokémon. Même ma vérité doit encore grandir. »</blockquote></div></div><div class="control-buttons"><button class="btn-primary" @click="start(true)">REJOUER ↗</button><button class="btn-outline" @click="share">PARTAGER</button></div></div></template>
          <template v-else-if="!canChoose"><div class="thinking"><span class="thinking-pulse"/>{{restoring?'REPRISE EN COURS…':waiting?'COMBAT EN COURS…':'N CHOISIT SON ACTION…'}}</div></template>
          <template v-else><div class="combat-tabs"><button :disabled="mustSwitch" :class="{active:!switchMode&&!mustSwitch}" @click="switchMode=false">ATTAQUER</button><button :class="{active:switchMode||mustSwitch}" @click="switchMode=true">CHANGER DE POKÉMON</button></div>
            <div v-if="!switchMode&&!mustSwitch" class="attack-grid"><div v-for="(m,i) in moves" :key="i" class="attack-unit"><button class="attack-choice" :class="['attack-'+moveCard(m.id||m.move).type.toLowerCase(),{chosen:selectedMove===i}]" :disabled="m.disabled||m.pp===0" @click="chooseMove(i)"><span class="attack-top"><b>{{m.move}}</b><span>PP {{m.pp}}/{{m.maxpp}}</span></span><span class="attack-bottom"><span>{{moveCard(m.id||m.move).typeFr}}</span><span>{{moveCard(m.id||m.move).categoryFr}} · {{moveCard(m.id||m.move).power}} PUI.</span></span></button><button class="info-button" :aria-label="'Détails de '+m.move" @click="openMoveInfo(i)">i</button></div></div>
            <div v-else class="change-grid"><button v-for="(sw,i) in switches" :key="i" class="change-mon" :disabled="sw.disabled" @click="chooseSwitch(i)"><img :src="sprite(sw.mon.id)" :alt="sw.mon.label" @error="imageFailed($event,sw.mon.id)"/><span><b>{{sw.mon.label}}</b><small>{{sw.active?'SUR LE TERRAIN':sw.disabled?'INDISPONIBLE':'ENVOYER AU COMBAT'}}</small></span></button></div>
          </template>
        </div>
      </div>
      <aside v-if="showIntel&&(running||!daily.result)" class="battle-sidebar"><div class="panel terrain-panel"><div class="panel-head"><span>✦ ÉTAT DU TERRAIN</span><small>{{fieldCount?'EFFETS ACTIFS':'NEUTRE'}}</small></div><div class="terrain-main"><div class="weather-symbol">{{field.weather==='Pluie'?'☂':field.weather==='Soleil'?'☀':field.weather==='Grêle'?'❄':field.weather==='Tempête de sable'?'◈':'◇'}}</div><div><span>MÉTÉO</span><b>{{field.weather||'Temps clair'}}</b></div></div><div class="field-row"><span>EFFETS GLOBAUX</span><div class="effect-tags"><span v-for="f in field.global" :key="f" class="effect-tag">{{f}}</span><em v-if="!field.global.length">Aucun</em></div></div><div class="field-row"><span>VOTRE CAMP</span><div class="effect-tags"><span v-for="f in field.ally" :key="f" class="effect-tag friendly">{{f}}</span><em v-if="!field.ally.length">Aucun piège ou écran</em></div></div><div class="field-row"><span>CAMP DE N</span><div class="effect-tags"><span v-for="f in field.foe" :key="f" class="effect-tag hostile">{{f}}</span><em v-if="!field.foe.length">Aucun piège ou écran</em></div></div></div>
        <div class="panel opponent-panel"><div class="panel-head"><span>L'ÉQUIPE DE N</span><small>06 / 06</small></div><div class="opponent-roster"><div v-for="(mon,i) in enemy" :key="mon.id" class="opponent-mon" :class="{down:view?.foes[i]?.fainted,active:view?.foes[i]?.active||(!running&&i===0)}"><img :src="sprite(mon.id)" :alt="mon.label" @error="imageFailed($event,mon.id)"/><span><b>{{mon.label}}</b><small>{{mon.types.map(typeLabel).join(' / ')}}</small></span><i/></div></div></div>
        <details class="panel journal"><summary>HISTORIQUE DU COMBAT <span>⌄</span></summary><div v-if="!history.length" class="journal-empty">Les actions importantes apparaîtront ici.</div><ol v-else><li v-for="(entry,i) in history" :key="i">{{entry}}</li></ol></details>
      </aside></div>
    </section>

    <section v-else-if="screen==='team'" class="collection-view" aria-label="Mon équipe"><div class="page-bar"><div><span class="overline">02 / VOTRE ROSTER DU JOUR</span><h1>Votre <em>équipe.</em></h1><p>Six Pokémon tirés pour tous les joueurs. Choisissez votre leader avant le défi.</p></div><button class="btn-primary" @click="goToChallenge">← RETOUR AU DÉFI</button></div><div class="collection-grid"><article v-for="(mon,i) in team" :key="mon.id" class="collection-card" :class="{selected:daily.lead===i,down:teamStatus(i)?.fainted}"><div class="collection-top"><span>#{{String(mon.id).padStart(3,'0')}}</span><b>{{teamStatus(i)?.fainted?'K.O.':teamStatus(i)?.active?'EN COMBAT':'NV. 100'}}</b></div><div class="collection-illustration"><img :key="'team-'+mon.id" :src="sprite(mon.id)" :alt="mon.label" @error="imageFailed($event,mon.id)"/></div><div class="collection-body"><h2>{{mon.label}}</h2><div class="type-list"><span v-for="t in mon.types" :key="t" class="type-chip" :class="'type-'+t.toLowerCase()">{{TYPE_FR[t]}}</span></div><p class="mon-gear">{{mon.ability}} <span>· {{mon.item||'Sans objet'}}</span></p><div class="mon-moves"><details v-for="m in mon.moves" :key="m"><summary><b>{{moveCard(m).name}}</b><small>{{moveCard(m).typeFr}} · {{moveCard(m).power}} PUI.</small></summary><p>{{moveCard(m).summary}}</p></details></div><button v-if="!daily.locked&&!ongoing" class="select-lead" :class="{on:daily.lead===i}" @click="pickLead(i)">{{daily.lead===i?'✓ POKÉMON DE TÊTE':'CHOISIR COMME LEADER'}}</button><div v-else class="collection-hp"><span>PV</span><div class="mini-hp"><i :style="{width:hpPct(teamStatus(i))+'%'}"/></div><b>{{hpPct(teamStatus(i))}}%</b></div></div></article></div><div class="bottom-return"><button class="btn-primary" @click="goToChallenge">← RETOUR AU DÉFI</button></div></section>

    <section v-else class="stats-view" aria-label="Statistiques"><div class="page-bar"><div><span class="overline">03 / VOTRE PARCOURS</span><h1>Le <em>palmarès.</em></h1><p>Vos performances officielles enregistrées sur cet appareil.</p></div><button class="btn-primary" @click="goToChallenge">← RETOUR AU DÉFI</button></div><div class="stats-grid"><div class="stat"><span>COMBATS JOUÉS</span><b>{{stats.played}}</b><small>OFFICIELS</small></div><div class="stat"><span>VICTOIRES</span><b>{{stats.wins}}</b><small>CONTRE N</small></div><div class="stat"><span>TAUX DE VICTOIRE</span><b>{{rate}}</b><small>COMBATS GAGNÉS</small></div><div class="stat"><span>SÉRIE ACTUELLE</span><b>{{streak}}</b><small>RECORD : {{stats.best}}</small></div></div><div class="stats-actions"><span>{{daily.result?'Défi du jour : '+labelForResult:'Votre défi officiel vous attend.'}}</span><button class="btn-outline" @click="share">PARTAGER MON RÉSULTAT ↗</button><button class="clear-button" @click="reset">Effacer mes données locales</button></div></section>
  </main>
  <div v-if="expandedMove&&moveInfo" class="overlay" @click.self="expandedMove=false"><div class="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-title"><button class="close-dialog" aria-label="Fermer" @click="expandedMove=false">✕</button><span class="overline">FICHE CAPACITÉ</span><h2 id="move-title">{{moveInfo.name}}</h2><div class="type-list"><span class="type-chip" :class="'type-'+moveInfo.type.toLowerCase()">{{moveInfo.typeFr}}</span><span class="type-chip neutral">{{moveInfo.categoryFr}}</span></div><div class="move-dialog-stats"><div><span>PUISSANCE</span><b>{{moveInfo.power}}</b></div><div><span>PRÉCISION</span><b>{{moveInfo.accuracy}}</b></div><div><span>PRIORITÉ</span><b>{{moveInfo.priority>0?'+':''}}{{moveInfo.priority}}</b></div><div><span>PP</span><b>{{moves[selectedMove]?.pp}}/{{moves[selectedMove]?.maxpp}}</b></div></div><p>{{moveInfo.summary}}</p><p v-if="moveInfo.effectiveness" class="effectiveness">{{moveInfo.effectiveness}} contre {{foeSpec.label}}</p><details><summary>Description technique complète (EN)</summary><p>{{moveInfo.original}}</p></details><button class="btn-primary" @click="expandedMove=false">FERMER</button></div></div>
  <div v-if="showGuide" class="overlay" @click.self="showGuide=false"><div class="move-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title"><button class="close-dialog" aria-label="Fermer" @click="showGuide=false">✕</button><span class="overline">GUIDE EXPRESS</span><h2 id="guide-title">Comment jouer ?</h2><p>Votre équipe de six Pokémon change à minuit (heure de Paris) et reste identique pour tous. N possède toujours ses cinq Pokémon habituels et alterne automatiquement entre Zekrom et Reshiram.</p><p>Choisissez votre Pokémon de tête depuis « Mon équipe », puis lancez votre unique tentative officielle. L'entraînement est illimité et n'affecte pas vos statistiques. Les règles de combat proviennent de Pokémon Showdown, génération 5.</p><p>Les sauvegardes restent locales à votre navigateur.</p><button class="btn-primary" @click="showGuide=false">COMPRIS</button></div></div>
  <div v-if="notice" role="status" class="toast">{{notice}}</div>
</div>
</template>
