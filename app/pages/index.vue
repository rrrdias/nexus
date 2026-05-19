<template>
  <div class="p-8 bg-slate-50 min-h-screen">
    <h2 class="text-2xl font-bold text-slate-800 mb-6">Dashboard Nexus</h2>
    
    <div class="p-6 bg-white rounded-xl shadow-sm border border-slate-200 space-y-6">
      <h3 class="text-lg font-medium text-slate-700">Teste do Design System PrimeVue</h3>
      
      <div class="flex items-center gap-4">
        <Button label="Ação Primária" icon="ti ti-check" />
        
        <Button label="Secundário" icon="ti ti-arrow-right" severity="secondary" outlined />

        <Badge value="Concluído" severity="success" />
        <Badge value="Ausente" severity="danger" />
        <Badge value="Aguardando" severity="info" />
      </div>
    </div>
  </div>
</template>

<script setup>
</script>