<template>
  <div class="flex h-screen bg-gray-100 font-sans antialiased overflow-hidden">
    <LayoutSidebar />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <LayoutTopbar />

      <main class="flex-1 overflow-y-auto p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
// O Nuxt fará o auto-import dos componentes dentro de app/components/layout/
</script>