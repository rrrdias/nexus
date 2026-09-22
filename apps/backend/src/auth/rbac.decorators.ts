import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULES_KEY = 'require_modules';
export const REQUIRE_ADMIN_KEY = 'require_admin';

/**
 * Declara quais módulos concedem acesso ao endpoint ou controller.
 * O usuário precisa ter acesso (direto ou via grupo) a pelo menos um dos módulos listados.
 * Exemplo: @RequireModule('ava') ou @RequireModule('scheduling', 'backoffice')
 */
export const RequireModule = (...modules: string[]) => SetMetadata(REQUIRE_MODULES_KEY, modules);

/**
 * Restringe o endpoint ou controller exclusivamente a Super Administradores.
 */
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN_KEY, true);
