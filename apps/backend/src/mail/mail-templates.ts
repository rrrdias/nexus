/**
 * apps/backend/src/mail/mail-templates.ts
 * Templates HTML padronizados com a identidade visual do NexusHub / Sistemas TED.
 */

function baseLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f5f7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1d23;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    .container {
      max-width: 600px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e8eaed;
    }
    .header {
      background: #1c2b4a;
      padding: 32px 40px;
      text-align: left;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .brand-accent { color: #2dce6c; }
    .header-tag {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #2dce6c;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .body-content {
      padding: 40px;
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #1c2b4a;
      margin: 0 0 16px 0;
    }
    .btn {
      display: inline-block;
      background-color: #22a857;
      color: #ffffff !important;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 10px;
      margin: 24px 0;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      margin-bottom: 10px;
      font-size: 14px;
    }
    .info-row:last-child { margin-bottom: 0; }
    .info-label {
      font-weight: 700;
      color: #475569;
      display: inline-block;
      min-width: 130px;
    }
    .info-value { color: #0f172a; font-weight: 600; }
    .footer {
      background: #f8fafc;
      padding: 24px 40px;
      border-top: 1px solid #e8eaed;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
    .footer strong { color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="brand">Nexus<span class="brand-accent">Hub</span></span>
      <br>
      <span class="header-tag">Sistemas Integrados • Tecnologias Educacionais</span>
    </div>
    <div class="body-content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Este é um e-mail automático enviado pela plataforma <strong>NexusHub</strong> (Sistemas TED).</p>
      <p>Por favor, não responda diretamente a esta mensagem.</p>
      <p>© 2026 Associação Educativa Evangélica (AEE) • Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Template de Recuperação de Senha
 */
export function getPasswordResetTemplate(name: string, resetUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Recuperação de Acesso — NexusHub';
  const firstName = name?.split(' ')[0] || 'Usuário';

  const html = baseLayout(
    subject,
    `
    <h1 class="title">Recuperação de Senha</h1>
    <p>Olá, <strong>${firstName}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir a sua senha de acesso à plataforma <strong>NexusHub</strong>.</p>
    <p>Para criar uma nova senha, clique no botão seguro abaixo:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn" target="_blank">Redefinir Minha Senha</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">
      Se o botão não funcionar, copie e cole o seguinte link no seu navegador:<br>
      <a href="${resetUrl}" style="color: #1976d2; word-break: break-all;">${resetUrl}</a>
    </p>
    <div class="info-card" style="border-left: 4px solid #f39c12;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Importante:</strong> Este link é válido por <strong>1 hora</strong>. Se você não solicitou esta redefinição, nenhuma ação é necessária e sua senha permanecerá inalterada.
      </p>
    </div>
    `
  );

  const text = `Olá, ${firstName}!\n\nRecebemos uma solicitação para redefinir sua senha no NexusHub.\n\nAcesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou, desconsidere este e-mail.\n\nSistemas TED - NexusHub`;

  return { subject, html, text };
}

/**
 * 2. Template de Boas-Vindas para Novos Usuários
 */
export function getWelcomeUserTemplate(
  name: string,
  login: string,
  accessUrl: string,
  temporaryPassword?: string,
): { subject: string; html: string; text: string } {
  const subject = 'Bem-vindo ao NexusHub — Seu acesso foi liberado!';
  const firstName = name?.split(' ')[0] || 'Usuário';

  const html = baseLayout(
    subject,
    `
    <h1 class="title">Bem-vindo ao NexusHub!</h1>
    <p>Olá, <strong>${name}</strong>,</p>
    <p>Seu perfil de acesso ao portal corporativo <strong>NexusHub</strong> (Sistemas Integrados de Tecnologias Educacionais) foi cadastrado com sucesso.</p>
    
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Usuário / Login:</span>
        <span class="info-value">${login}</span>
      </div>
      ${
        temporaryPassword
          ? `
      <div class="info-row">
        <span class="info-label">Senha Inicial:</span>
        <span class="info-value" style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${temporaryPassword}</span>
      </div>
      `
          : ''
      }
      <div class="info-row">
        <span class="info-label">Ambiente:</span>
        <span class="info-value">Portal de Gestão e Inteligência Acadêmica</span>
      </div>
    </div>

    <p>Clique no botão abaixo para acessar a plataforma com suas credenciais:</p>
    <div style="text-align: center;">
      <a href="${accessUrl}" class="btn" target="_blank">Acessar Plataforma NexusHub</a>
    </div>
    ${
      temporaryPassword
        ? `<p style="font-size: 13px; color: #64748b;">Recomendamos alterar sua senha no primeiro acesso à plataforma.</p>`
        : ''
    }
    `
  );

  const text = `Olá, ${name}!\n\nSeu acesso à plataforma NexusHub foi liberado.\nUsuário: ${login}\n${temporaryPassword ? `Senha inicial: ${temporaryPassword}\n` : ''}Acesse: ${accessUrl}\n\nSistemas TED - NexusHub`;

  return { subject, html, text };
}

/**
 * 3. Template de Confirmação de Agendamento de Prova Presencial
 */
export interface SchedulingConfirmationParams {
  studentName: string;
  matricula: string;
  poloNome: string;
  data: string;
  hora: string;
  sala?: string;
  disciplinas?: string[];
  periodo?: string;
}

export function getSchedulingConfirmationTemplate(params: SchedulingConfirmationParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Confirmação de Agendamento de Prova — Polo ${params.poloNome}`;
  const firstName = params.studentName?.split(' ')[0] || 'Estudante';

  const html = baseLayout(
    subject,
    `
    <h1 class="title">Agendamento Confirmado!</h1>
    <p>Olá, <strong>${firstName}</strong>,</p>
    <p>Seu agendamento para a realização de provas presenciais foi registrado com sucesso no sistema institucional.</p>
    
    <div class="info-card" style="border-left: 4px solid #22a857;">
      <div class="info-row">
        <span class="info-label">Estudante:</span>
        <span class="info-value">${params.studentName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Matrícula:</span>
        <span class="info-value font-mono">${params.matricula}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Polo de Prova:</span>
        <span class="info-value">${params.poloNome}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data da Prova:</span>
        <span class="info-value">${params.data}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Horário de Início:</span>
        <span class="info-value">${params.hora}</span>
      </div>
      ${
        params.sala
          ? `
      <div class="info-row">
        <span class="info-label">Sala / Laboratório:</span>
        <span class="info-value">${params.sala}</span>
      </div>
      `
          : ''
      }
      ${
        params.periodo
          ? `
      <div class="info-row">
        <span class="info-label">Período Letivo:</span>
        <span class="info-value">${params.periodo}</span>
      </div>
      `
          : ''
      }
    </div>

    ${
      params.disciplinas && params.disciplinas.length > 0
        ? `
      <h3 style="font-size: 15px; color: #1c2b4a; margin-top: 20px; margin-bottom: 8px;">Disciplinas a serem avaliadas:</h3>
      <ul style="padding-left: 20px; margin-bottom: 20px; color: #475569; font-size: 14px;">
        ${params.disciplinas.map((d) => `<li style="margin-bottom: 4px;"><strong>${d}</strong></li>`).join('')}
      </ul>
      `
        : ''
    }

    <div class="info-card" style="background: #fffbeb; border-color: #fef3c7;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Orientações Importantes:</strong><br>
        • Compareça ao polo com <strong>20 minutos de antecedência</strong> portando documento oficial de identificação com foto.<br>
        • Não será permitida a entrada após o início das avaliações.<br>
        • Em caso de dúvidas, procure a coordenação do seu polo de apoio.
      </p>
    </div>
    `
  );

  const text = `Olá, ${firstName}!\n\nSeu agendamento de prova presencial foi confirmado.\n\nMatrícula: ${params.matricula}\nPolo: ${params.poloNome}\nData: ${params.data}\nHorário: ${params.hora}\n${params.sala ? `Sala: ${params.sala}\n` : ''}\nCompareça com 20 minutos de antecedência portando documento com foto.\n\nSistemas TED - AEE`;

  return { subject, html, text };
}

/**
 * 4. Template de Acolhimento e Orientação Pedagógica da Tutoria
 */
export interface TutoriaOrientationParams {
  studentName?: string;
  alunoNome?: string;
  tutorName?: string;
  tutorNome?: string;
  disciplina?: string;
  disciplinaNome?: string;
  mensagem: string;
  periodo?: string;
  linkAva?: string;
}

export function getTutoriaOrientationTemplate(params: TutoriaOrientationParams): {
  subject: string;
  html: string;
  text: string;
} {
  const finalDisciplina = params.disciplina || params.disciplinaNome || 'Sua Disciplina EaD';
  const finalStudentName = params.studentName || params.alunoNome || 'Estudante';
  const finalTutorName = params.tutorName || params.tutorNome || 'Tutor Pedagógico';
  const subject = `Orientações de Estudos — ${finalDisciplina} | Tutoria EaD`;
  const firstName = finalStudentName?.split(' ')[0] || 'Estudante';
  const avaUrl = params.linkAva || 'https://avaead.unievangelica.edu.br';

  const html = baseLayout(
    subject,
    `
    <h1 class="title">Acompanhamento Pedagógico da Tutoria</h1>
    <p>Olá, <strong>${firstName}</strong>,</p>
    <p>Sou o seu tutor <strong>${finalTutorName}</strong> na disciplina <strong>${finalDisciplina}</strong>.</p>
    
    <div class="info-card" style="border-left: 4px solid #1976d2; background: #f0f7ff;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e3a8a; white-space: pre-wrap;">${params.mensagem}</p>
    </div>

    <p>Estamos acompanhando seu progresso e colocamos nossa equipe à sua disposição para apoiar sua jornada acadêmica.</p>

    <div style="text-align: center;">
      <a href="${avaUrl}" class="btn" style="background-color: #1976d2;" target="_blank">Acessar Ambiente Virtual (AVA)</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
      Atenciosamente,<br>
      <strong>${finalTutorName}</strong><br>
      Equipe de Tutoria & Tecnologias Educacionais (TED)
    </p>
    `
  );

  const text = `Olá, ${firstName}!\n\nSou o seu tutor ${finalTutorName} na disciplina ${finalDisciplina}.\n\n${params.mensagem}\n\nAcesse o AVA: ${avaUrl}\n\nAtenciosamente,\n${finalTutorName} - Tutoria TED`;

  return { subject, html, text };
}
