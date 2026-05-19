export default defineEventHandler(async (event) => {
  // Tenta obter a sessão de forma robusta. 
  // O getUserSession é um utilitário do nuxt-oidc-auth que pode ser auto-importado.
  let session: any = null;
  try {
    session = await (getUserSession as any)(event);
  } catch (e) {
    console.log('getUserSession not available, falling back to context');
    session = event.context.oidc || (event.context as any).oidcAuth;
  }

  console.log('Full OIDC Session:', JSON.stringify(session, null, 2));

  if (!session || (!session.loggedInAt && !session.user)) {
    console.error('Session not found or user not logged in');
    throw createError({
      statusCode: 401,
      statusMessage: "Sessão não encontrada ou expirada. Faça login novamente.",
    });
  }

  // Se a sessão veio via getUserSession, os dados estão na raiz.
  // Se veio via event.context.oidc (middleware manual), os dados costumam estar em session.user
  const userSession = session.user || session;
  console.log('User Session Object:', JSON.stringify(userSession, null, 2));

  // Busca o ID do usuário - tentando múltiplas propriedades comuns e aninhadas
  const userid = userSession?.userName || 
                 userSession?.preferred_username ||
                 userSession?.userInfo?.preferred_username || 
                 userSession?.userInfo?.userName ||
                 userSession?.userInfo?.sub ||
                 userSession?.sub ||
                 userSession?.email ||
                 userSession?.userInfo?.email;

  if (!userid) {
    console.error('User ID not found. Session structure:', JSON.stringify(userSession, null, 2));
    throw createError({
      statusCode: 401,
      statusMessage: "Usuário não identificado na sessão. Verifique os claims do Keycloak.",
    });
  }

  try {
    const userWithAccess = await prisma.user.findUnique({
      where: { userid: userid },
      include: {
        systemAccess: {
          include: { systemModule: true },
        },
      },
    });

    if (!userWithAccess) {
      throw createError({
        statusCode: 404,
        statusMessage: "Colaborador não encontrado.",
      });
    }

    return {
      success: true,
      user: {
        name: userWithAccess.name,
        role: userWithAccess.role,
        isActive: userWithAccess.isActive,
      },
      systems: userWithAccess.systemAccess.map((access) => access.systemModule),
    };
  } catch (error: any) {
    return createError({ statusCode: 500, statusMessage: "Erro interno." });
  }
});