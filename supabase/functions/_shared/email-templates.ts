// ── Clube Bem Bolado Email Templates ───────────────────────────────────────────────────
// Design system: purple #7c3aed, gradient header, clean card, mobile-first

function baseTemplate(preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Clube Bem Bolado</title>
  <style>
    body { margin:0; padding:0; background:#f4f2fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .wrap { max-width:600px; margin:0 auto; padding:32px 16px 48px; }
    .card { background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,.10); }
    .header { background:#ffffff; padding:32px 32px 28px; text-align:center; border-bottom:1px solid #f0ebfb; }
    .logo { font-size:26px; font-weight:900; color:#fff; letter-spacing:-.04em; }
    .logo-accent { color:#a78bfa; }
    .body { padding:32px 32px 36px; }
    h1 { margin:0 0 8px; font-size:22px; font-weight:800; color:#1e1245; letter-spacing:-.03em; line-height:1.2; }
    p { margin:16px 0 0; font-size:15px; color:#4b5563; line-height:1.6; }
    .btn-wrap { margin:28px 0 0; text-align:center; }
    .btn { display:inline-block; background:#7c3aed; color:#fff !important; text-decoration:none; font-size:15px; font-weight:700; padding:14px 36px; border-radius:50px; letter-spacing:.01em; }
    .btn:hover { background:#6d28d9; }
    .link-fallback { margin:16px 0 0; font-size:12px; color:#9ca3af; word-break:break-all; }
    .divider { height:1px; background:#f0ebfb; margin:24px 0; }
    .footer { padding:0 32px 32px; }
    .footer p { font-size:12px; color:#9ca3af; margin:0; line-height:1.6; }
    .badge { display:inline-block; background:#f5f0ff; color:#7c3aed; font-size:12px; font-weight:700; padding:4px 12px; border-radius:20px; letter-spacing:.04em; text-transform:uppercase; margin-bottom:16px; }
    @media (max-width:480px) {
      .body, .footer { padding-left:20px; padding-right:20px; }
      h1 { font-size:20px; }
    }
  </style>
</head>
<body>
  <!-- preheader hidden text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div style="font-size:32px;font-weight:900;font-family:Arial,Helvetica,sans-serif;letter-spacing:-1px;line-height:1;text-align:center;">
          <span style="color:#6600ee;">clubi</span><span style="color:#ff00cc;">ee</span>
        </div>
      </div>
      <div class="body">
        ${bodyHtml}
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin:20px 0 0;">
      © ${new Date().getFullYear()} Clube Bem Bolado · CIEE. Todos os direitos reservados.
    </p>
  </div>
</body>
</html>`
}

// ── Reset de senha ────────────────────────────────────────────────────────────

export function resetPasswordEmail(nome: string, resetUrl: string): string {
  const firstName = nome?.split(' ')[0] ?? 'por aí'
  const body = `
    <div class="badge">Segurança</div>
    <h1>Redefinir sua senha</h1>
    <p>Olá, <strong>${firstName}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta no Clube Bem Bolado.</p>
    <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
    <div class="btn-wrap">
      <a class="btn" href="${resetUrl}">Redefinir senha</a>
    </div>
    <p class="link-fallback">Ou copie e cole este link no seu navegador:<br />${resetUrl}</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9ca3af;">Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
  `
  return baseTemplate('Redefinição de senha solicitada para sua conta Clube Bem Bolado', body)
}

// ── Confirmação de e-mail ─────────────────────────────────────────────────────

export function confirmEmailTemplate(nome: string, confirmUrl: string): string {
  const firstName = nome?.split(' ')[0] ?? 'por aí'
  const body = `
    <div class="badge">Boas-vindas</div>
    <h1>Confirme seu e-mail</h1>
    <p>Olá, <strong>${firstName}</strong>! Obrigado por criar sua conta no Clube Bem Bolado — a comunidade universitária de experiências e benefícios.</p>
    <p>Para ativar sua conta, confirme seu endereço de e-mail clicando no botão abaixo:</p>
    <div class="btn-wrap">
      <a class="btn" href="${confirmUrl}">Confirmar e-mail</a>
    </div>
    <p class="link-fallback">Ou copie e cole este link no seu navegador:<br />${confirmUrl}</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9ca3af;">Se você não criou uma conta no Clube Bem Bolado, ignore este e-mail.</p>
  `
  return baseTemplate('Confirme seu e-mail para acessar o Clube Bem Bolado', body)
}

// ── Email para o ganhador ─────────────────────────────────────────────────────

export function winnerEmail(nome: string, premio: string, experienceName: string, drawDate: string): string {
  const firstName = nome?.split(' ')[0] ?? 'por aí'
  const drawFormatted = drawDate
    ? new Date(drawDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const body = `
    <div class="badge">🏆 Parabéns!</div>
    <h1>Você ganhou, ${firstName}!</h1>
    <p>É com muito orgulho que comunicamos: você foi sorteado(a) como vencedor(a) da experiência <strong>${experienceName}</strong>!</p>
    <div style="background:#f5f0ff;border-radius:14px;padding:20px 24px;margin:24px 0;">
      <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Seu prêmio</div>
      <div style="font-size:18px;font-weight:800;color:#1e1245;line-height:1.3;">${premio}</div>
      ${drawFormatted ? `<div style="font-size:13px;color:#6b7280;margin-top:6px;">Sorteado em ${drawFormatted}</div>` : ''}
    </div>
    <p>Em breve nossa equipe entrará em contato para combinar a entrega do seu prêmio. Fique atento ao seu e-mail!</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9ca3af;">Dúvidas? Entre em contato pelo site do Clube Bem Bolado ou responda este e-mail.</p>
  `
  return baseTemplate(`🏆 Você ganhou ${premio} no Clube Bem Bolado!`, body)
}
