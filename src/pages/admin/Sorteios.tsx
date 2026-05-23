import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/adminLog'
import { useAuth } from '@/contexts/AuthContext'
import type { DbExperience, DbSorteio, DbUser } from '@/types/database'
import styles from './Sorteios.module.css'

interface ExpWithSorteio extends DbExperience {
  sorteio?: DbSorteio
  enrolled_count: number
}

export default function Sorteios() {
  const [items, setItems] = useState<ExpWithSorteio[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [sortearItem, setSortearItem] = useState<ExpWithSorteio | null>(null)
  const [detailItem, setDetailItem] = useState<ExpWithSorteio | null>(null)
  const [editItem, setEditItem] = useState<ExpWithSorteio | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: exps } = await supabase
      .from('experiences')
      .select('*')
      .order('created_at', { ascending: false })

    if (!exps) { setLoading(false); return }

    const withSorteios = await Promise.all(exps.map(async (exp) => {
      const [{ data: sorteioData }, { count }] = await Promise.all([
        supabase.from('sorteios').select('*').eq('experience_id', exp.id).limit(1).maybeSingle(),
        supabase.from('participations').select('*', { count: 'exact', head: true }).eq('experience_id', exp.id),
      ])
      return { ...exp, sorteio: sorteioData ?? undefined, enrolled_count: count ?? 0 }
    }))

    setItems(withSorteios)
    setLoading(false)
  }

  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Experiências</div>
          <div className="page-sub">{!loading && `${items.length} cadastradas · `}Crie experiências e configure os sorteios vinculados</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowWizard(true)}>+ Nova experiência</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Carregando…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎪</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>Nenhuma experiência criada</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Clique em "+ Nova experiência" para começar</div>
        </div>
      ) : (
        <div className={styles.expGrid}>
          {items.map(item => (
            <ExpCard
              key={item.id}
              item={item}
              onSortear={() => setSortearItem(item)}
              onDetail={() => setDetailItem(item)}
              onEdit={() => setEditItem(item)}
              onOcultar={async () => {
                await supabase
                  .from('experiences')
                  .update({ oculto_em: new Date().toISOString() })
                  .eq('id', item.id)
                logAdminAction('experience_ocultada', {
                  entidade: 'experience',
                  entidade_id: item.id,
                  descricao: `Experiência ocultada do portal: ${item.name}`,
                })
                load()
              }}
            />
          ))}
        </div>
      )}

      {showWizard && <ExperienceWizard onClose={() => { setShowWizard(false); load() }} />}
      {sortearItem && <SortearModal item={sortearItem} onClose={() => { setSortearItem(null); load() }} />}
      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
      {editItem && <EditExperienceModal item={editItem} onClose={() => { setEditItem(null); load() }} />}
    </div>
  )
}

// ── Experience card (admin) ──────────────────────────────────────────────────

function ExpCard({ item, onSortear, onDetail, onEdit, onOcultar }: { item: ExpWithSorteio; onSortear: () => void; onDetail: () => void; onEdit: () => void; onOcultar: () => void }) {
  const s = item.sorteio
  const canSortear = s && s.status !== 'encerrado' && s.draw_date && new Date(s.draw_date) <= new Date()
  const canOcultar = s?.status === 'encerrado' && !item.oculto_em

  return (
    <div className={styles.expCard} onClick={onDetail} style={{ cursor: 'pointer' }}>
      <div className={styles.expThumb}>
        {item.img_url
          ? <img src={item.img_url} alt={item.name} className={styles.expImg} />
          : <div className={styles.expThumbPlaceholder}>🎪</div>
        }
        <span className={`badge ${s?.status === 'encerrado' ? 'badge-gray' : item.active ? 'badge-green' : 'badge-gray'}`} style={{ position: 'absolute', top: 10, right: 10 }}>
          {s?.status === 'encerrado' ? 'Encerrado' : item.active ? 'Ativo' : 'Inativo'}
        </span>
        {item.oculto_em && (
          <span className="badge badge-gray" style={{ position: 'absolute', top: 10, left: 10 }}>🚫 Oculto</span>
        )}
        {item.super_destaque && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10,
            background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
            color: '#1c1000', fontSize: 10, fontWeight: 800,
            letterSpacing: '.05em', textTransform: 'uppercase',
            borderRadius: 100, padding: '3px 9px',
            boxShadow: '0 2px 6px rgba(245,158,11,.5)',
          }}>⭐ Destaque</span>
        )}
      </div>
      <div className={styles.expBody}>
        <div className={styles.expName}>{item.name}</div>
        {item.description && <div className={styles.expDesc}>{item.description}</div>}
        <div className={styles.expMeta}>
          <span>👥 {item.enrolled_count} inscritos</span>
          {item.start_date && <span>📅 {new Date(item.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
          {item.end_date && <span>até {new Date(item.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
          {item.limit_participants && <span>🔢 Limite: {item.limit_participants}</span>}
        </div>

        {s ? (
          <div className={styles.sorteioInfo}>
            <div className={styles.sorteioTitle}>
              🎲 {s.premio}
              <span className={`badge ${s.status === 'ativo' ? 'badge-amber' : 'badge-gray'}`} style={{ marginLeft: 8 }}>
                {s.status === 'ativo' ? 'Pendente' : 'Encerrado'}
              </span>
            </div>
            {s.draw_date && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Data: {new Date(s.draw_date + 'T00:00:00').toLocaleDateString('pt-BR')} · {s.n_ganhadores} vencedor(es)
              </div>
            )}
            {canSortear && (
              <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={e => { e.stopPropagation(); onSortear() }}>
                🎲 Realizar sorteio
              </button>
            )}
            {s.status === 'encerrado' && (
              <div style={{ color: 'var(--success)', fontSize: 12, marginTop: 8, fontWeight: 600 }}>✓ Sorteio realizado</div>
            )}
            {s?.status !== 'encerrado' && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8, width: '100%', fontSize: 12 }}
                onClick={e => { e.stopPropagation(); onEdit() }}
              >
                ✏️ Editar experiência
              </button>
            )}
            {canOcultar && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8, width: '100%', fontSize: 12 }}
                onClick={e => { e.stopPropagation(); onOcultar() }}
              >
                🚫 Ocultar do portal
              </button>
            )}
            {item.oculto_em && (
              <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 8 }}>
                Oculto desde {new Date(item.oculto_em).toLocaleDateString('pt-BR')}
              </div>
            )}
            {s.status === 'ativo' && !canSortear && s.draw_date && (
              <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 8 }}>
                Disponível em {new Date(s.draw_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>Sem sorteio configurado</div>
        )}
      </div>
    </div>
  )
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: ExpWithSorteio; onClose: () => void }) {
  const [enrolled, setEnrolled] = useState<DbUser[]>([])
  const [winners, setWinners] = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)
  const s = item.sorteio

  useEffect(() => {
    async function load() {
      const { data: enrollments } = await supabase
        .from('participations')
        .select('user_id')
        .eq('experience_id', item.id)

      const ids = (enrollments ?? []).map(e => e.user_id)

      const [usersRes, winnersRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('users').select('id, nome, email, ref_code, status').in('id', ids)
          : Promise.resolve({ data: [] }),
        s ? supabase.from('sorteio_ganhadores').select('posicao, user_id, users(id, nome, email, ref_code)').eq('sorteio_id', s.id).order('posicao') : Promise.resolve({ data: [] }),
      ])

      setEnrolled((usersRes.data as DbUser[]) ?? [])
      const winnerUsers = ((winnersRes.data ?? []) as any[]).map(w => w.users).filter(Boolean)
      setWinners(winnerUsers)
      setLoading(false)
    }
    load()
  }, [item.id])

  return (
    <div className="modal-backdrop open">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {item.img_url && (
            <img src={item.img_url} alt={item.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
          )}
          <div>
            <div className="modal-title" style={{ marginBottom: 4 }}>{item.name}</div>
            {item.description && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.description}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
              {item.start_date && <span>📅 {new Date(item.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
              {item.end_date && <span>→ {new Date(item.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
              {item.limit_participants && <span>🔢 Limite: {item.limit_participants}</span>}
              <span className={`badge ${item.active ? 'badge-green' : 'badge-gray'}`}>{item.active ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>
        </div>

        {s && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Sorteio</div>
            <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>🎲 {s.premio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              {s.draw_date && `Data: ${new Date(s.draw_date + 'T00:00:00').toLocaleDateString('pt-BR')} · `}
              {s.n_ganhadores} vencedor(es) · <span className={`badge ${s.status === 'ativo' ? 'badge-amber' : 'badge-gray'}`}>{s.status === 'ativo' ? 'Pendente' : 'Encerrado'}</span>
            </div>
            {winners.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 6 }}>🏆 Vencedor(es)</div>
                {winners.map((w: any) => (
                  <div key={w.id} style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{w.nome} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {w.email}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Inscritos ({enrolled.length})
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 16 }}><span className="spinner" /></div>
        ) : enrolled.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhum inscrito ainda.</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enrolled.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{u.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <code style={{ fontSize: 11 }}>{u.ref_code}</code>
                  <span className={`badge ${u.status === 'ativo' ? 'badge-green' : 'badge-gray'}`}>{u.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: 20 }}>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Wizard ───────────────────────────────────────────────────────────────────

function ExperienceWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [termoAdesao, setTermoAdesao] = useState('')
  const [category, setCategory] = useState('shows')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [active, setActive] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [limitParticipants, setLimitParticipants] = useState('')
  const [superDestaque, setSuperDestaque] = useState(false)

  // Step 2
  const [titulo, setTitulo] = useState('')
  const [drawDate, setDrawDate] = useState('')
  const [nWinners, setNWinners] = useState(1)

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function nextStep() {
    if (!name.trim())  { setError('Nome é obrigatório.'); return }
    if (!startDate)    { setError('Data de início é obrigatória.'); return }
    if (!endDate)      { setError('Data de fim é obrigatória.'); return }
    if (endDate < startDate) { setError('Data de fim deve ser após a data de início.'); return }
    setError('')
    setStep(2)
  }

  async function handleSubmit() {
    if (!titulo.trim()) { setError('Título do sorteio é obrigatório.'); return }
    if (!drawDate) { setError('Data do sorteio é obrigatória.'); return }
    setLoading(true)
    setError('')

    try {
      // 1. Upload image
      let img_url: string | null = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('experiences').upload(path, imageFile, { upsert: true })
        if (uploadErr) {
          throw new Error(`Erro no upload da imagem: ${uploadErr.message}`)
        }
        img_url = supabase.storage.from('experiences').getPublicUrl(path).data.publicUrl
      }

      // 2. Create experience
      const { data: exp, error: expErr } = await supabase.from('experiences').insert({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim() || null,
        termo_adesao: termoAdesao.trim() || null,
        img_url,
        active,
        category,
        start_date: startDate || null,
        end_date: endDate || null,
        limit_participants: limitParticipants ? Number(limitParticipants) : null,
        super_destaque: superDestaque,
      }).select().single()

      if (expErr) throw new Error(expErr.message)

      // 3. Create sorteio linked to experience
      const { error: sorteioErr } = await supabase.from('sorteios').insert({
        premio: titulo.trim(),
        experience_id: exp.id,
        draw_date: drawDate,
        encerramento: drawDate,
        n_ganhadores: nWinners,
        elegivel: 'todos',
        status: 'ativo',
      })

      if (sorteioErr) throw new Error(sorteioErr.message)

      logAdminAction('experiencia_criada', {
        entidade: 'experience',
        entidade_id: exp.id,
        descricao: `Criou experiência "${name.trim()}"`,
        metadata: { categoria: category, premio: titulo.trim(), draw_date: drawDate },
      })

      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop open">
      <div className={`modal ${styles.wizardModal}`}>
        <div className={styles.wizardSteps}>
          <div className={`${styles.wizardStep} ${step >= 1 ? styles.wizardActive : ''}`}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepLabel}>Experiência</div>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.wizardStep} ${step >= 2 ? styles.wizardActive : ''}`}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepLabel}>Sorteio</div>
          </div>
        </div>

        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {step === 1 && (
          <>
            <div className="modal-title">Nova experiência</div>
            <div className="modal-sub">Preencha os dados da experiência exibida para os membros.</div>

            <div className="form-group">
              <label>Nome *</label>
              <input className="input" placeholder="Ex: Show The Weeknd" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Categoria *</label>
              <div className={styles.catPills}>
                {([
                  ['shows',      'Shows'],
                  ['cultura',    'Cultura'],
                  ['tecnologia', 'Tecnologia'],
                  ['carreira',   'Carreira'],
                  ['esportes',   'Esportes'],
                  ['arte',       'Arte'],
                  ['negocios',   'Negócios'],
                  ['lifestyle',  'Lifestyle'],
                  ['viagem',     'Viagem'],
                  ['bem_estar',  'Bem-estar'],
                ] as [string, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`${styles.catPill} ${category === val ? styles.catPillActive : ''}`}
                    onClick={() => setCategory(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea className="input" placeholder="Descreva a experiência..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label>Termo de Adesão</label>
              <textarea className="input" placeholder="Descreva as condições de participação, elegibilidade, transferência de ingresso..." value={termoAdesao} onChange={e => setTermoAdesao(e.target.value)} rows={4} />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>Este texto será exibido ao membro antes de confirmar a participação.</div>
            </div>
            <div className="form-group">
              <label>Imagem</label>
              <input type="file" accept="image/*" className="input" onChange={handleImageChange} />
              {imagePreview && <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Data de início *</label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Data de fim *</label>
                <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Limite de participantes</label>
                <input className="input" type="number" min={1} placeholder="Sem limite" value={limitParticipants} onChange={e => setLimitParticipants(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="input" value={active ? 'ativo' : 'inativo'} onChange={e => setActive(e.target.value === 'ativo')}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            {/* ── Super Destaque toggle ── */}
            <div className="form-group">
              <label>⭐ Super Destaque</label>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, cursor: 'pointer' }}
                onClick={() => setSuperDestaque(s => !s)}
              >
                <div style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: superDestaque ? '#f59e0b' : 'var(--border)',
                  position: 'relative', transition: 'background .2s',
                  boxShadow: superDestaque ? '0 0 8px rgba(245,158,11,.4)' : 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: superDestaque ? 23 : 3,
                    width: 18, height: 18, borderRadius: 9,
                    background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                  }} />
                </div>
                <span style={{ fontSize: 13, color: superDestaque ? '#f59e0b' : 'var(--text-2)', fontWeight: superDestaque ? 600 : 400 }}>
                  {superDestaque ? 'Ativo — aparece no topo com destaque ⭐' : 'Desativado — exibição normal'}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={nextStep}>Próximo →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="modal-title">Configurar sorteio</div>
            <div className="modal-sub">Apenas usuários ativos inscritos nesta experiência participarão do sorteio.</div>

            <div className="form-group">
              <label>Título do sorteio *</label>
              <input className="input" placeholder="Ex: 2 ingressos VIP The Weeknd" value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Data do sorteio *</label>
                <input className="input" type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Nº de vencedores</label>
                <input className="input" type="number" min={1} value={nWinners} onChange={e => setNWinners(Number(e.target.value))} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => { setStep(1); setError('') }}>← Voltar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="spinner" /> : '✅ Criar experiência'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Edit experience modal ────────────────────────────────────────────────────

function EditExperienceModal({ item, onClose }: { item: ExpWithSorteio; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [termoAdesao, setTermoAdesao] = useState(item.termo_adesao ?? '')
  const [category, setCategory] = useState(item.category)
  const [active, setActive] = useState(item.active)
  const [startDate, setStartDate] = useState(item.start_date ?? '')
  const [endDate, setEndDate] = useState(item.end_date ?? '')
  const [limitParticipants, setLimitParticipants] = useState(item.limit_participants?.toString() ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(item.img_url ?? '')
  const [superDestaque, setSuperDestaque] = useState(item.super_destaque)

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim())  { setError('Nome é obrigatório.'); return }
    if (!startDate)    { setError('Data de início é obrigatória.'); return }
    if (!endDate)      { setError('Data de fim é obrigatória.'); return }
    if (endDate < startDate) { setError('Data de fim deve ser após a data de início.'); return }
    setLoading(true)
    setError('')
    try {
      let img_url = item.img_url
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('experiences').upload(path, imageFile, { upsert: true })
        if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`)
        img_url = supabase.storage.from('experiences').getPublicUrl(path).data.publicUrl
      }

      const { error: updErr } = await supabase.from('experiences').update({
        name: name.trim(),
        description: description.trim() || null,
        termo_adesao: termoAdesao.trim() || null,
        category,
        active,
        start_date: startDate || null,
        end_date: endDate || null,
        limit_participants: limitParticipants ? Number(limitParticipants) : null,
        img_url,
        super_destaque: superDestaque,
      }).eq('id', item.id)

      if (updErr) throw new Error(updErr.message)

      logAdminAction('experiencia_editada', {
        entidade: 'experience',
        entidade_id: item.id,
        descricao: `Editou experiência "${name.trim()}"`,
      })

      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-title">Editar experiência</div>
        <div className="modal-sub">Atualize os dados da experiência.</div>

        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <div className="form-group">
          <label>Nome *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Categoria *</label>
          <div className={styles.catPills}>
            {([
              ['shows', 'Shows'], ['cultura', 'Cultura'], ['tecnologia', 'Tecnologia'],
              ['carreira', 'Carreira'], ['esportes', 'Esportes'], ['arte', 'Arte'],
              ['negocios', 'Negócios'], ['lifestyle', 'Lifestyle'], ['viagem', 'Viagem'],
              ['bem_estar', 'Bem-estar'],
            ] as [string, string][]).map(([val, label]) => (
              <button key={val} type="button"
                className={`${styles.catPill} ${category === val ? styles.catPillActive : ''}`}
                onClick={() => setCategory(val as typeof item.category)}
              >{label}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Termo de Adesão</label>
          <textarea className="input" rows={4} value={termoAdesao} onChange={e => setTermoAdesao(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Imagem</label>
          <input type="file" accept="image/*" className="input" onChange={handleImageChange} />
          {imagePreview && <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Data de início *</label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Data de fim *</label>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Limite de participantes</label>
            <input className="input" type="number" min={1} placeholder="Sem limite" value={limitParticipants} onChange={e => setLimitParticipants(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="input" value={active ? 'ativo' : 'inativo'} onChange={e => setActive(e.target.value === 'ativo')}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        {/* ── Super Destaque toggle ── */}
        <div className="form-group">
          <label>⭐ Super Destaque</label>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, cursor: 'pointer' }}
            onClick={() => setSuperDestaque(s => !s)}
          >
            <div style={{
              width: 44, height: 24, borderRadius: 12, flexShrink: 0,
              background: superDestaque ? '#f59e0b' : 'var(--border)',
              position: 'relative', transition: 'background .2s',
              boxShadow: superDestaque ? '0 0 8px rgba(245,158,11,.4)' : 'none',
            }}>
              <div style={{
                position: 'absolute', top: 3,
                left: superDestaque ? 23 : 3,
                width: 18, height: 18, borderRadius: 9,
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 4px rgba(0,0,0,.25)',
              }} />
            </div>
            <span style={{ fontSize: 13, color: superDestaque ? '#f59e0b' : 'var(--text-2)', fontWeight: superDestaque ? 600 : 400 }}>
              {superDestaque ? 'Ativo — aparece no topo com destaque ⭐' : 'Desativado — exibição normal'}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : '💾 Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sortear modal ─────────────────────────────────────────────────────────────

function SortearModal({ item, onClose }: { item: ExpWithSorteio; onClose: () => void }) {
  const { teamMember } = useAuth()
  const sorteio = item.sorteio!
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'spinning' | 'done' | 'error'>('idle')
  const [winners, setWinners] = useState<DbUser[]>([])
  const [drumName, setDrumName] = useState('?')
  const [eligible, setEligible] = useState<DbUser[]>([])
  const [loadingEligible, setLoadingEligible] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [auditInfo, setAuditInfo] = useState<{ hash_lista: string; hash_resultado: string } | null>(null)
  const [emailsSent, setEmailsSent] = useState<string[]>([])
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { loadEligible() }, [])

  async function loadEligible() {
    const { data: enrollments } = await supabase
      .from('participations')
      .select('user_id')
      .eq('experience_id', item.id)

    const enrolledIds = (enrollments ?? []).map(e => e.user_id)
    if (enrolledIds.length === 0) { setLoadingEligible(false); return }

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'ativo')
      .in('id', enrolledIds)

    setEligible(users ?? [])
    setLoadingEligible(false)
  }

  async function sortear() {
    if (eligible.length === 0 || phase === 'spinning') return
    setPhase('spinning')
    setErrorMsg('')

    const nomes = eligible.map(u => u.nome.split(' ')[0])
    let ticks = 0
    const TOTAL_TICKS = 48 // ~3.6s de animação
    const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

    // Chama edge function server-side (sorteio + email num único call)
    const sorteioPromise = fetch(
      'https://ctnjluwpblbarwiysrsw.supabase.co/functions/v1/realizar-sorteio',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ sorteio_id: sorteio.id, executado_por: teamMember?.id ?? null }),
      }
    )

    ivRef.current = setInterval(async () => {
      ticks++
      setDrumName(nomes[Math.floor(Math.random() * nomes.length)])

      if (ticks >= TOTAL_TICKS) {
        clearInterval(ivRef.current!)

        let data: {
          ganhadores: string[]
          total_inscritos: number
          hash_lista: string
          hash_resultado: string
          emails_enviados: string[]
          error?: string
        }

        try {
          const res = await sorteioPromise
          data = await res.json()
          if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Erro ao executar sorteio.')
          setDrumName('!')
          setPhase('error')
          return
        }

        const ganhadoresIds = data.ganhadores ?? []
        const picked = eligible.filter(u => ganhadoresIds.includes(u.id))
        setDrumName(picked[0]?.nome.split(' ')[0] ?? '🏆')
        setWinners(picked)
        setAuditInfo({ hash_lista: data.hash_lista, hash_resultado: data.hash_resultado })
        if (data.emails_enviados?.length > 0) setEmailsSent(data.emails_enviados)

        logAdminAction('sorteio_executado', {
          entidade: 'sorteio',
          entidade_id: String(sorteio.id),
          descricao: `Executou sorteio #${sorteio.id} — ${sorteio.premio}`,
          metadata: { ganhadores: ganhadoresIds, total_inscritos: data.total_inscritos, hash_lista: data.hash_lista },
        })

        setPhase('done')
      }
    }, 75)
  }

  const FEW_PARTICIPANTS = eligible.length > 0 && eligible.length < 5

  return (
    <div className="modal-backdrop open">
      <div className="modal" style={{ width: 'min(500px, 92vw)' }}>
        <div className="modal-title">🎲 {sorteio.premio}</div>

        {loadingEligible ? (
          <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>
        ) : eligible.length === 0 ? (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
            ⚠️ Nenhum participante elegível. Certifique-se que existem usuários ativos inscritos nesta experiência.
          </div>
        ) : (
          <>
            {/* Aviso de poucos participantes */}
            {FEW_PARTICIPANTS && phase === 'idle' && (
              <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, padding: '12px 16px', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
                ⚠️ Esta experiência tem apenas <strong>{eligible.length} participante{eligible.length > 1 ? 's' : ''}</strong>. O sorteio é válido, mas recomendamos ter mais inscritos para maior representatividade.
              </div>
            )}

            {/* Confirmação antes de sortear */}
            {phase === 'confirm' && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '16px', marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>Confirmar sorteio?</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                  {eligible.length} participante{eligible.length > 1 ? 's' : ''} elegíve{eligible.length > 1 ? 'is' : 'l'} · {sorteio.n_ganhadores} vencedor(es)<br />
                  <strong style={{ color: 'var(--danger)' }}>Esta ação não pode ser desfeita.</strong>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn" onClick={() => setPhase('idle')}>Cancelar</button>
                  <button className="btn btn-primary" onClick={sortear}>🎲 Confirmar e sortear</button>
                </div>
              </div>
            )}

            {/* Drum machine — visível em spinning e done */}
            {(phase === 'spinning' || phase === 'done') && (
              <div className={styles.drumWrap}>
                <div className={`${styles.drumSlot} ${styles.drumSingle} ${phase === 'spinning' ? styles.spinning : ''} ${phase === 'done' ? styles.winner : ''}`}>
                  {drumName}
                </div>
              </div>
            )}

            {/* Idle: só mostra contador */}
            {phase === 'idle' && (
              <div className="modal-sub" style={{ marginBottom: 8 }}>
                👥 {eligible.length} participante{eligible.length > 1 ? 's' : ''} elegíve{eligible.length > 1 ? 'is' : 'l'} · {sorteio.n_ganhadores} vencedor(es)
              </div>
            )}

            {errorMsg && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>{errorMsg}</div>
            )}

            {phase === 'done' && winners.length > 0 && (
              <>
                <div className={styles.winnerReveal}>
                  <div className={styles.trophy}>🏆</div>
                  <div className={styles.wrLabel}>{winners.length === 1 ? 'Ganhador(a)' : `${winners.length} Ganhadores`}</div>
                  {winners.map((w, i) => (
                    <div key={w.id}>
                      {winners.length > 1 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{i + 1}º lugar</div>}
                      <div className={styles.wrName}>{w.nome}</div>
                      <div className={styles.wrCode}>{w.ref_code} · {w.email}</div>
                    </div>
                  ))}
                </div>
                {emailsSent.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#15803d' }}>
                    ✉️ Email enviado para: {emailsSent.join(', ')}
                  </div>
                )}
                {auditInfo && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>🔒 Auditoria</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                      <div><strong>Hash inscritos:</strong> {auditInfo.hash_lista}</div>
                      <div><strong>Hash resultado:</strong> {auditInfo.hash_resultado}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
          {eligible.length > 0 && phase === 'idle' && (
            <button className="btn btn-primary" onClick={() => setPhase('confirm')}>
              🎲 Realizar sorteio
            </button>
          )}
          {phase === 'spinning' && (
            <button className="btn btn-primary" disabled>
              <span className="spinner" /> Sorteando…
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
