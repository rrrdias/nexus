<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-navy">Bom dia, Carlos</h1>
      <p class="text-gray-500 text-sm">Você tem acesso a 6 de 9 sistemas disponíveis.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div v-for="stat in stats" :key="stat.label" 
        class="bg-white p-5 rounded-lg border-t-4 shadow-sm"
        :class="stat.borderClass">
        <div class="flex justify-between items-start">
          <p class="text-2xl font-bold text-gray-900 font-mono">{{ stat.value }}</p>
          <span :class="stat.textClass" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100">
            {{ stat.trend }}
          </span>
        </div>
        <p class="text-xs text-gray-400 mt-1 uppercase font-semibold tracking-wider">{{ stat.label }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 class="font-bold text-navy flex items-center gap-2">
            <i class="ti ti-calendar-check text-green"></i> Agendamentos Recentes
          </h3>
          <button class="text-xs text-green font-bold hover:underline">Ver todos</button>
        </div>
        <div class="p-0">
          <div class="p-8 text-center text-gray-400 italic text-sm">
            Nenhum agendamento pendente para hoje.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const stats = [
  { label: 'Colaboradores', value: '248', trend: '+4 este mês', borderClass: 'border-green', textClass: 'text-green' },
  { label: 'Solicitações', value: '31', trend: '7 pendentes', borderClass: 'border-amber', textClass: 'text-amber' },
  { label: 'Disciplinas', value: '1.204', trend: 'Atualizado hoje', borderClass: 'border-blue-act', textClass: 'text-blue-act' },
  { label: 'Chamados', value: '12', trend: '3 críticos', borderClass: 'border-red', textClass: 'text-red' },
]
</script>