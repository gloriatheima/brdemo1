<template>
   <div id="app">
  <BrHeader></BrHeader>
  <router-view />

  </div>
</template>

<script>
import BrHeader from './components/BrHeader.vue';


export default {
components:{
  BrHeader
  
}
}
</script>

<style>

</style>