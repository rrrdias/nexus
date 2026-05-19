// https://nuxt.com/docs/api/configuration/nuxt-config
import { definePreset } from "@primevue/themes";
import Aura from "@primevue/themes/aura";

const NexusPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#ecfdf5",
      100: "#d1fae5",
      200: "#a7f3d0",
      300: "#6ee7b7",
      400: "#34d399",
      500: "#27AE60", // Verde principal da identidade
      600: "#059669",
      700: "#047857",
      800: "#065f46",
      900: "#064e3b",
      950: "#022c22",
    },
    // Você pode forçar o PrimeVue a respeitar o fundo escuro da sua Sidebar
    colorScheme: {
      dark: {
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617", // Tom de navy super escuro
        },
      },
    },
  },
});

export default defineNuxtConfig({
  css: ['~/assets/css/tailwind.css'],
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  modules: ["@nuxtjs/tailwindcss", "@primevue/nuxt-module", "nuxt-oidc-auth"],

  primevue: {
    options: {
      theme: {
        preset: NexusPreset,
        options: {
          darkModeSelector: ".dark", // Permite alternar light/dark via Tailwind
          cssLayer: {
            name: "primevue",
            order: "tailwind-base, primevue, tailwind-utilities",
          },
        },
      },
    },
  },
  oidc: {
    defaultProvider: "keycloak",
    providers: {
      keycloak: {
        clientId: process.env.OIDC_KEYCLOAK_CLIENT_ID,
        clientSecret: process.env.OIDC_KEYCLOAK_CLIENT_SECRET,
        baseUrl: process.env.OIDC_KEYCLOAK_ISSUER,
        userNameClaim: "preferred_username", // Garante que o username venha do campo certo
        exposeAccessToken: true, // Permite que a nossa API leia o token depois
        redirectUri: "http://localhost:3001/auth/keycloak/callback",
        responseMode: "query",
        // 🚀 Adicione esta linha para guiar o Keycloak na saída:
        logoutRedirectUri: "http://localhost:3001",
      },
    },
    middleware: {
      globalMiddlewareEnabled: true, // 🔒 Protege TODAS as rotas automaticamente
      customLoginPage: false, // Usa a tela de login nativa do Keycloak
    },
    session: {
      cookie: {
        secure: false, // Importante para rodar em localhost sem HTTPS
      },
      cookieName: "nexus-session", // Nome customizado para evitar conflitos
    },
  },

  // Otimização sugerida pelo Vite para os DevTools
  vite: {
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },

  app: {
    head: {
      title: "Nexus - Painel Corporativo",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
    },
  },
});
