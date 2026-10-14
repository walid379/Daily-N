<script setup lang="ts">
import {ref,watch} from 'vue';
import {sprite,art} from '../data/teams';

const props=withDefaults(defineProps<{id:number;label:string;back?:boolean}>(),{back:false});
const source=ref('');
const fallbackLevel=ref(0);
// Ne jamais conserver un ancien GIF lorsqu'on sélectionne une autre espèce.
watch(()=>[props.id,props.back] as const,()=>{
  fallbackLevel.value=0;
  source.value=sprite(props.id,props.back);
},{immediate:true});
function onError():void {
  if(fallbackLevel.value===0){fallbackLevel.value=1;source.value=art(props.id);}
  else {
    fallbackLevel.value=2;
    // SVG embarqué : jamais de sprite périmé, même si PokeAPI est indisponible.
    const safe=props.label.replace(/[&<>\"]/g,'');
    source.value='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160"><rect width="200" height="160" rx="16" fill="#203c3c"/><text x="100" y="82" fill="#d3e6d5" font-size="14" text-anchor="middle">${safe}</text></svg>`);
  }
}
</script>

<template>
  <img :key="`${id}-${back?'back':'front'}-${fallbackLevel}`" :src="source"
    :alt="label" :data-pokemon-id="id" @error="onError" />
</template>
