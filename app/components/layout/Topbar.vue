<template>
    <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
        <div class="flex items-center gap-4">
            <h2 class="text-gray-500 font-medium text-sm flex items-center gap-2">
                Dashboard <i class="ti ti-chevron-right text-[10px]"></i> <span
                    class="text-navy font-bold">Início</span>
            </h2>
        </div>

        <div class="flex items-center gap-6">
            <div class="hidden md:flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200">
                <i class="ti ti-search text-gray-400"></i>
                <input type="text" placeholder="Buscar no Nexus..."
                    class="bg-transparent border-none text-xs focus:ring-0 text-gray-600 ml-2 w-48" />
            </div>

            <div class="flex items-center gap-3 border-l pl-6 border-gray-200">
                <div class="text-right hidden sm:block">
                    <p class="text-sm font-bold text-navy leading-none">
                        {{ userName }}
                    </p>
                    <p class="text-[10px] text-green font-semibold uppercase tracking-tighter mt-1">
                        {{ userRole }}
                    </p>
                </div>

                <div
                    class="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm shadow-inner border border-navy/10">
                    {{ userInitials }}
                </div>
            </div>
        </div>
    </header>
</template>

<script setup>
import { computed } from 'vue'

const headers = useRequestHeaders(['cookie'])

const { data: apiData } = await useAsyncData('shared-user-data', () => 
  $fetch('/api/systems/my-modules', { headers })
)

// 2. Mantemos o OIDC apenas como garantia
const { user: oidcUser } = useOidcAuth()

// 3. Captura o nome
const userName = computed(() => {
    return apiData.value?.user?.name || oidcUser.value?.userInfo?.name || 'Ricardo Dias'
})

// 4. Mapeia a Role REAL (Com log para termos certeza absoluta do que chegou)
const userRole = computed(() => {
    if (!apiData.value) return 'CARREGANDO...'

    const role = apiData.value?.user?.role

    // Deixei este log temporário. Se continuar dando Colaborador, ele vai nos dizer o motivo!
    console.log('Role recebida do banco:', role)

    if (role === 'SUPER_ADMIN') return 'SUPER ADMIN'
    if (role === 'ADMIN') return 'ADMINISTRADOR'

    return 'COLABORADOR'
})

// 5. Calcula as iniciais
const userInitials = computed(() => {
    const name = userName.value
    if (!name) return 'NX'

    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})
</script>