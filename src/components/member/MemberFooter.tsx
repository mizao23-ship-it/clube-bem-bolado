import { useState } from 'react'
import styles from './MemberFooter.module.css'

type PolicyKey = 'privacidade' | 'termos' | 'cookies'

const POLICIES: Record<PolicyKey, { title: string; content: string }> = {
  privacidade: {
    title: 'Política de Privacidade',
    content: `
## Política de Privacidade — Clube Bem Bolado

**Última atualização:** abril de 2026

A Clube Bem Bolado está comprometida com a privacidade e a proteção dos dados pessoais de seus membros, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).

---

### 1. Quais dados coletamos

- **Dados de cadastro:** nome completo, e-mail, telefone/WhatsApp.
- **Dados acadêmicos:** faculdade/instituição, curso e semestre (opcionais).
- **Dados de uso:** participações em experiências, indicações realizadas, interações na plataforma.
- **Dados técnicos:** endereço IP, tipo de navegador, páginas acessadas e data/hora de acesso.

---

### 2. Como utilizamos seus dados

- Gerenciar seu cadastro e acesso à plataforma.
- Realizar sorteios e comunicar os resultados.
- Enviar comunicações sobre novidades, experiências e benefícios (você pode optar por não receber a qualquer momento).
- Cumprir obrigações legais e regulatórias.
- Melhorar continuamente a experiência da plataforma.

---

### 3. Compartilhamento de dados

Seus dados podem ser compartilhados com:
- **Parceiros de benefícios** (New Value), para liberação de acesso aos benefícios contratados.
- **Ferramentas de CRM** (RD Station), para comunicação e gestão do relacionamento.
- **Prestadores de serviços** que auxiliam na operação da plataforma, sempre sob contrato de confidencialidade.

Não vendemos seus dados pessoais a terceiros.

---

### 4. Armazenamento e segurança

Seus dados são armazenados em servidores seguros (Supabase/AWS). Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.

---

### 5. Seus direitos (LGPD)

Você tem direito a:
- Confirmar a existência de tratamento dos seus dados.
- Acessar, corrigir ou atualizar seus dados.
- Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.
- Solicitar a portabilidade dos dados.
- Revogar o consentimento a qualquer momento.

Para exercer seus direitos, entre em contato: **contato@clubbembolado.com.br**

---

### 6. Retenção de dados

Mantemos seus dados enquanto você for membro ativo. Após o encerramento da conta, dados podem ser retidos pelo período mínimo exigido por lei.

---

### 7. Alterações nesta política

Podemos atualizar esta política periodicamente. Notificaremos mudanças relevantes por e-mail ou dentro da plataforma.

---

### 8. Contato

Dúvidas? Fale com nosso encarregado de dados (DPO): **contato@clubbembolado.com.br**
    `.trim(),
  },

  termos: {
    title: 'Termos de Uso',
    content: `
## Termos de Uso — Clube Bem Bolado

**Última atualização:** abril de 2026

Ao acessar e utilizar a plataforma Clube Bem Bolado, você concorda com os termos e condições descritos abaixo. Leia com atenção.

---

### 1. Sobre a Clube Bem Bolado

A Clube Bem Bolado é um clube de experiências e benefícios exclusivos para estudantes universitários. A plataforma oferece acesso a sorteios de experiências culturais, de entretenimento e desenvolvimento, além de benefícios e descontos de parceiros.

---

### 2. Cadastro e elegibilidade

- O acesso é restrito a pessoas físicas, maiores de 16 anos.
- Você é responsável pela veracidade das informações fornecidas no cadastro.
- É proibido criar múltiplas contas para a mesma pessoa.
- O uso de dados falsos pode resultar na suspensão imediata da conta.

---

### 3. Participação em experiências

- As experiências são sorteadas entre membros participantes de forma aleatória e imparcial.
- A participação em um sorteio não garante premiação.
- Os ganhadores serão notificados pela plataforma e deverão responder em até **72 horas** para não perder o prêmio.
- Prêmios são pessoais e intransferíveis, salvo indicação em contrário.

---

### 4. Programa de indicações

- Cada membro possui um código de indicação único.
- O código deve ser utilizado apenas para indicar pessoas genuinamente interessadas.
- É proibido o uso de meios automatizados, spam ou qualquer prática fraudulenta para gerar indicações.

---

### 5. Uso da plataforma

É proibido:
- Tentar burlar mecanismos de sorteio ou indicação.
- Compartilhar acesso à conta com terceiros.
- Publicar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.
- Realizar engenharia reversa ou tentativas de invasão da plataforma.

---

### 6. Suspensão e encerramento

A Clube Bem Bolado reserva-se o direito de suspender ou encerrar contas que violem estes termos, sem aviso prévio, em casos de:
- Uso fraudulento.
- Fornecimento de informações falsas.
- Violação das regras de conduta.

---

### 7. Limitação de responsabilidade

A Clube Bem Bolado não se responsabiliza por:
- Problemas técnicos temporários fora de nosso controle.
- Qualidade dos serviços prestados por parceiros terceiros.
- Danos indiretos decorrentes do uso da plataforma.

---

### 8. Propriedade intelectual

Todo o conteúdo da plataforma (marca, design, textos, imagens) é de propriedade da Clube Bem Bolado e protegido por lei. É proibida a reprodução sem autorização expressa.

---

### 9. Alterações nos termos

Podemos modificar estes termos a qualquer momento. O uso continuado da plataforma após as alterações implica aceitação dos novos termos.

---

### 10. Foro

Fica eleito o foro da comarca de São Paulo/SP para dirimir eventuais controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.

---

Dúvidas? **contato@clubbembolado.com.br**
    `.trim(),
  },

  cookies: {
    title: 'Política de Cookies',
    content: `
## Política de Cookies — Clube Bem Bolado

**Última atualização:** abril de 2026

Esta política explica como a Clube Bem Bolado utiliza cookies e tecnologias similares para melhorar sua experiência na plataforma.

---

### 1. O que são cookies?

Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você acessa um site. Eles permitem que a plataforma reconheça seu dispositivo e lembre preferências entre sessões.

---

### 2. Cookies que utilizamos

| Tipo | Finalidade | Duração |
|------|-----------|---------|
| **Essenciais** | Manter sua sessão autenticada e o funcionamento básico da plataforma | Sessão / persistente |
| **Funcionais** | Lembrar preferências como idioma e configurações | Até 1 ano |
| **Analíticos** | Entender como os membros usam a plataforma para melhorias | Até 2 anos |
| **Marketing** | Comunicações personalizadas via RD Station | Até 1 ano |

---

### 3. Cookies essenciais (obrigatórios)

Estes cookies são necessários para o funcionamento da plataforma e não podem ser desativados:

- **sb-auth-token** — Mantém sua sessão de login ativa (Supabase Auth).
- **sb-refresh-token** — Renova automaticamente sua sessão sem precisar fazer login novamente.

---

### 4. Cookies de sessão

Utilizamos o **sessionStorage** do navegador para controlar a exibição de anúncios e comunicados durante a sessão, garantindo que a mesma mensagem não apareça repetidamente.

---

### 5. Cookies de terceiros

Nossa plataforma pode utilizar cookies de:
- **Supabase** — infraestrutura de autenticação e banco de dados.
- **RD Station** — ferramenta de CRM e comunicação de marketing.

Recomendamos consultar as políticas de privacidade desses serviços para mais informações.

---

### 6. Como gerenciar cookies

Você pode controlar e/ou deletar cookies nas configurações do seu navegador:
- [Google Chrome](https://support.google.com/chrome/answer/95647)
- [Mozilla Firefox](https://support.mozilla.org/pt-BR/kb/cookies-informacoes-que-os-sites-armazenam-no-seu)
- [Safari](https://support.apple.com/pt-br/guide/safari/sfri11471/mac)
- [Microsoft Edge](https://support.microsoft.com/pt-br/microsoft-edge/excluir-cookies-no-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)

**Atenção:** desativar cookies essenciais pode impedir o funcionamento correto da plataforma, incluindo o login.

---

### 7. Dúvidas

Entre em contato: **contato@clubbembolado.com.br**
    `.trim(),
  },
}

export default function MemberFooter() {
  const [open, setOpen] = useState<PolicyKey | null>(null)
  const policy = open ? POLICIES[open] : null

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.links}>
            <a
              href="https://www.instagram.com/clubbembolado/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.igLink}
              aria-label="Instagram do Clube Bem Bolado"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              @clubbembolado
            </a>
            <span className={styles.sep}>·</span>
            <button className={styles.link} onClick={() => setOpen('privacidade')}>
              Política de Privacidade
            </button>
            <span className={styles.sep}>·</span>
            <button className={styles.link} onClick={() => setOpen('termos')}>
              Termos de Uso
            </button>
            <span className={styles.sep}>·</span>
            <button className={styles.link} onClick={() => setOpen('cookies')}>
              Política de Cookies
            </button>
          </div>
          <div className={styles.copy}>
            © 2026 Clube Bem Bolado. Todos os direitos reservados. · Criado por{' '}
            <a href="https://valenoxia.com" target="_blank" rel="noopener noreferrer" className={styles.valenoxia}>
              Valenoxia
            </a>
          </div>
        </div>
      </footer>

      {/* ── Modal ── */}
      {policy && (
        <div className={styles.overlay} onClick={() => setOpen(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{policy.title}</div>
              <button className={styles.closeBtn} onClick={() => setOpen(null)} aria-label="Fechar">✕</button>
            </div>
            <div className={styles.modalBody}>
              <PolicyContent raw={policy.content} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Renderizador simples de markdown-like ── */
function PolicyContent({ raw }: { raw: string }) {
  const lines = raw.split('\n')

  return (
    <div className={styles.policyContent}>
      {lines.map((line, i) => {
        if (line.startsWith('## '))   return <h2 key={i}>{line.slice(3)}</h2>
        if (line.startsWith('### '))  return <h3 key={i}>{line.slice(4)}</h3>
        if (line.startsWith('---'))   return <hr key={i} />
        if (line.startsWith('- '))    return <li key={i}>{renderInline(line.slice(2))}</li>
        if (line.startsWith('| '))    return <TableRow key={i} raw={line} />
        if (line.trim() === '')       return <div key={i} className={styles.spacer} />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function TableRow({ raw }: { raw: string }) {
  const cells = raw.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/))
  if (cells.length === 0) return null
  return (
    <div className={styles.tableRow}>
      {cells.map((c, i) => (
        <div key={i} className={styles.tableCell}>{renderInline(c)}</div>
      ))}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}
