<template>
  <aside class="w-64 bg-navy flex flex-col h-full shadow-2xl z-30">
    <div class="p-6 flex items-center gap-3 border-b border-navy-light/20">
      <div class="w-10 h-10 rounded-lg bg-green flex items-center justify-center text-white shadow-lg shadow-green/20">
        <i class="ti ti-box-model-2 text-2xl"></i>
      </div>
      <div>
        <h1 class="text-white font-semibold text-xl tracking-tight">Nexus<span class="text-green-light">Hub</span></h1>
        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Nexus Application</p>
      </div>
    </div>

    <div v-if="data?.user"
      class="p-4 mx-4 mt-4 bg-navy-mid rounded-lg flex items-center gap-3 border border-navy-light/50">
      <div class="w-10 h-10 rounded-full bg-white text-navy flex items-center justify-center font-bold text-sm">
        {{ initials }}
      </div>
      <div class="flex flex-col">
        <span class="text-white text-sm font-medium tracking-tight truncate max-w-[140px]">{{ data.user.name }}</span>
        <span class="text-green-light text-[10px] font-bold uppercase tracking-wider mt-0.5">{{ data.user.role }}</span>
      </div>
    </div>

    <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
      <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-4">Módulos Disponíveis</div>

      <NuxtLink to="/" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
        :class="[route.path === '/' ? 'bg-green/10 text-green-light border-l-4 border-green' : 'text-gray-400 hover:bg-navy-light hover:text-white']">
        <i class="ti ti-layout-dashboard text-xl"></i>
        <span class="text-sm font-medium">Dashboard</span>
      </NuxtLink>

      <NuxtLink v-for="sys in data?.systems" :key="sys.id" :to="sys.pathUrl"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
        :class="[route.path === sys.pathUrl ? 'bg-green/10 text-green-light border-l-4 border-green' : 'text-gray-400 hover:bg-navy-light hover:text-white']">
        <i :class="['ti', sys.iconClass, 'text-xl']"></i>
        <span class="text-sm font-medium">{{ sys.name }}</span>
      </NuxtLink>
    </nav>

    <div class="p-4 bg-navy-mid/50 border-t border-navy-light/20">
      <button @click="logout('keycloak')"
        class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-navy-light text-gray-400 hover:text-white transition-colors">
        <i class="ti ti-logout text-lg"></i>
        <span class="text-sm">Sair do sistema</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
const route = useRoute()

// Importa o método de logout do módulo OIDC
const { logout } = useOidcAuth()

const headers = useRequestHeaders(['cookie'])

// Dispara a requisição anexando os cookies para o backend reconhecer a sessão
const { data, error } = await useAsyncData('shared-user-data', () => 
  $fetch('/api/systems/my-modules', { headers })
)

// Gera as iniciais do nome de forma reativa
const initials = computed(() => {
  if (!data.value?.user?.name) return '??'
  return data.value.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
})
</script>