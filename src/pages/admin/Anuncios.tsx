import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/adminLog'
import { CURSOS } from '@/lib/cursos'
import styles from './Anuncios.module.css'

interface Announcement {
  id: string
  nome: string
  tipo: string
  titulo: string
  descricao: string | null
  midia_url: string | null
  cta_label: string
  cta_url: string | null
  cta_url_mobile: string | null
  veiculacao: string
  veiculacao_dias: number | null
  publico_alvo: string
  cursos_alvo: string[] | null
  ativo: boolean
  prioridade: number
  data_inicio: string | null
  data_fim: string | null
  created_at: string
}

const TIPO_LABELS: Record<string, string> = {
  imagem: 'Imagem',
  video_youtube: 'Vídeo YouTube',
  texto: 'Texto',
  indicacao: 'Indicação',
}

const TIPO_COLORS: Record<string, string> = {
  imagem: '#7E00E5',
  video_youtube: '#dc2626',
  texto: '#059669',
  indicacao: '#f59e0b',
}

const VEICULACAO_LABELS: Record<string, string> = {
  uma_vez: 'Mostrar uma vez',
  por_sessao: 'Por sessão',
  sempre: 'Sempre',
  a_cada_N_dias: 'A cada N dias',
}

interface FormState {
  nome: string
  tipo: string
  titulo: string
  descricao: string
  midia_url: string
  cta_label: string
  cta_url: string
  cta_url_mobile: string
  veiculacao: string
  veiculacao_dias: string
  publico_alvo: string
  cursos_alvo: string[]
  ativo: boolean
  prioridade: string
  data_inicio: string
  data_fim: string
}

const DEFAULT_FORM: FormState = {
  nome: '',
  tipo: 'imagem',
  titulo: '',
  descricao: '',
  midia_url: '',
  cta_label: 'Entendido!',
  cta_url: '',
  cta_url_mobile: '',
  veiculacao: 'uma_vez',
  veiculacao_dias: '',
  publico_alvo: 'todos',
  cursos_alvo: [],
  ativo: false,
  prioridade: '0',
  data_inicio: '',
  data_fim: '',
}

export default function Anuncios() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cursoSearch, setCursoSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(ann: Announcement) {
    setEditing(ann)
    setForm({
      nome: ann.nome,
      tipo: ann.tipo,
      titulo: ann.titulo,
      descricao: ann.descricao ?? '',
      midia_url: ann.midia_url ?? '',
      cta_label: ann.cta_label,
      cta_url: ann.cta_url ?? '',
      cta_url_mobile: ann.cta_url_mobile ?? '',
      veiculacao: ann.veiculacao,
      veiculacao_dias: ann.veiculacao_dias?.toString() ?? '',
      publico_alvo: ann.publico_alvo,
      cursos_alvo: ann.cursos_alvo ?? [],
      ativo: ann.ativo,
      prioridade: ann.prioridade.toString(),
      data_inicio: ann.data_inicio ?? '',
      data_fim: ann.data_fim ?? '',
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setError('')
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addCurso(curso: string) {
    if (!curso || form.cursos_alvo.includes(curso)) return
    setField('cursos_alvo', [...form.cursos_alvo, curso])
    setCursoSearch('')
  }

  function removeCurso(curso: string) {
    setField('cursos_alvo', form.cursos_alvo.filter(c => c !== curso))
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `announcements/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('announcements')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage
        .from('announcements')
        .getPublicUrl(path)
      setField('midia_url', urlData.publicUrl)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload da imagem.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function isValidUrl(url: string) {
    try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' }
    catch { return false }
  }

  async function handleSave() {
    setError('')
    if (!form.nome.trim()) { setError('Nome interno é obrigatório.'); return }
    if (!form.titulo.trim()) { setError('Título é obrigatório.'); return }
    if (form.midia_url.trim() && !isValidUrl(form.midia_url.trim())) {
      setError('URL da mídia inválida. Use o formato https://...'); return
    }
    if (form.cta_url.trim() && !isValidUrl(form.cta_url.trim())) {
      setError('URL do botão (desktop) inválida. Use o formato https://...'); return
    }
    if (form.cta_url_mobile.trim() && !isValidUrl(form.cta_url_mobile.trim())) {
      setError('URL do botão (mobile) inválida. Use o formato https://...'); return
    }
    if (form.veiculacao === 'a_cada_N_dias' && !form.veiculacao_dias) {
      setError('Informe o número de dias para a veiculação.'); return
    }
    if (form.publico_alvo === 'por_curso' && form.cursos_alvo.length === 0) {
      setError('Selecione pelo menos um curso para o público-alvo.'); return
    }

    setSaving(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        midia_url: form.midia_url.trim() || null,
        cta_label: form.cta_label.trim() || 'Entendido!',
        cta_url: form.cta_url.trim() || null,
        cta_url_mobile: form.cta_url_mobile.trim() || null,
        veiculacao: form.veiculacao,
        veiculacao_dias: form.veiculacao === 'a_cada_N_dias' ? parseInt(form.veiculacao_dias) : null,
        publico_alvo: form.publico_alvo,
        cursos_alvo: form.publico_alvo === 'por_curso' ? form.cursos_alvo : null,
        ativo: form.ativo,
        prioridade: parseInt(form.prioridade) || 0,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error: updateErr } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editing.id)
        if (updateErr) throw updateErr
        logAdminAction('anuncio_editado', {
          entidade: 'announcements',
          entidade_id: editing.id,
          descricao: `Anúncio "${form.nome}" atualizado`,
        })
      } else {
        const { error: insertErr } = await supabase
          .from('announcements')
          .insert(payload)
        if (insertErr) throw insertErr
        logAdminAction('anuncio_criado', {
          entidade: 'announcements',
          descricao: `Anúncio "${form.nome}" criado`,
        })
      }

      closeModal()
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar anúncio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAtivo(ann: Announcement) {
    const { error: updateErr } = await supabase
      .from('announcements')
      .update({ ativo: !ann.ativo, updated_at: new Date().toISOString() })
      .eq('id', ann.id)
    if (!updateErr) {
      logAdminAction('anuncio_toggle_ativo', {
        entidade: 'announcements',
        entidade_id: ann.id,
        descricao: `Anúncio "${ann.nome}" ${!ann.ativo ? 'ativado' : 'desativado'}`,
      })
      await load()
    }
  }

  async function handleDelete(ann: Announcement) {
    const { error: delErr } = await supabase
      .from('announcements')
      .delete()
      .eq('id', ann.id)
    if (!delErr) {
      logAdminAction('anuncio_excluido', {
        entidade: 'announcements',
        entidade_id: ann.id,
        descricao: `Anúncio "${ann.nome}" excluído`,
      })
    }
    setConfirmDelete(null)
    await load()
  }

  const filteredCursos = cursoSearch.trim()
    ? CURSOS.filter(c => c.toLowerCase().includes(cursoSearch.toLowerCase()) && !form.cursos_alvo.includes(c))
    : CURSOS.filter(c => !form.cursos_alvo.includes(c))

  return (
    <div className="page-enter">
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <div className="page-title">Anúncios</div>
          <div className="page-sub">{!loading && `${items.length} cadastrados · `}Gerencie os anúncios exibidos para os membros</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Novo anúncio</button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Carregando…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>Nenhum anúncio criado</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            Clique em "+ Novo anúncio" para começar
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map(ann => (
            <div key={ann.id} className={styles.anuncioCard}>
              {/* Mídia preview */}
              {ann.midia_url && ann.tipo === 'imagem' && (
                <div className={styles.mediaPreview}>
                  <img src={ann.midia_url} alt={ann.titulo} />
                </div>
              )}
              {ann.tipo === 'video_youtube' && (
                <div className={styles.mediaPreview} style={{ background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: 24 }}>
                  ▶
                </div>
              )}
              {ann.tipo === 'texto' && !ann.midia_url && (
                <div className={styles.mediaPreview} style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 24 }}>
                  📝
                </div>
              )}

              {/* Info */}
              <div className={styles.cardInfo}>
                <div className={styles.cardTop}>
                  <span
                    className={styles.tipoBadge}
                    style={{ background: TIPO_COLORS[ann.tipo] + '22', color: TIPO_COLORS[ann.tipo] }}
                  >
                    {TIPO_LABELS[ann.tipo] ?? ann.tipo}
                  </span>
                  <span className={styles.prioTag}>P: {ann.prioridade}</span>
                </div>
                <div className={styles.cardNome}>{ann.nome}</div>
                <div className={styles.cardTitulo}>{ann.titulo}</div>
                <div className={styles.cardMeta}>
                  <span>{VEICULACAO_LABELS[ann.veiculacao] ?? ann.veiculacao}</span>
                  <span>·</span>
                  <span>{ann.publico_alvo === 'todos' ? 'Todos os membros' : `Cursos (${ann.cursos_alvo?.length ?? 0})`}</span>
                  {ann.data_inicio && <><span>·</span><span>De {ann.data_inicio}</span></>}
                  {ann.data_fim && <><span>·</span><span>Até {ann.data_fim}</span></>}
                </div>
              </div>

              {/* Actions */}
              <div className={styles.cardActions}>
                {/* Ativo toggle */}
                <button
                  className={`${styles.toggleBtn} ${ann.ativo ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => handleToggleAtivo(ann)}
                  title={ann.ativo ? 'Desativar' : 'Ativar'}
                >
                  {ann.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => openEdit(ann)}>
                  Editar
                </button>
                <button
                  className="btn"
                  style={{ fontSize: 13, padding: '6px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                  onClick={() => setConfirmDelete(ann)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {editing ? 'Editar anúncio' : 'Novo anúncio'}
              </div>
              <button className={styles.modalClose} onClick={closeModal}>×</button>
            </div>

            <div className={styles.modalBody}>
              {error && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* ── Identificação ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Identificação</div>

                <div className={styles.formGroup}>
                  <label>Nome interno (admin) *</label>
                  <input
                    className="input"
                    placeholder="Ex: iFood — 2 meses grátis"
                    value={form.nome}
                    onChange={e => setField('nome', e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Tipo *</label>
                  <div className={styles.radioRow}>
                    {(['imagem', 'video_youtube', 'texto', 'indicacao'] as const).map(t => (
                      <label key={t} className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="tipo"
                          value={t}
                          checked={form.tipo === t}
                          onChange={() => setField('tipo', t)}
                        />
                        {TIPO_LABELS[t]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Prioridade</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      value={form.prioridade}
                      onChange={e => setField('prioridade', e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                      Maior número = exibido primeiro
                    </div>
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Status</label>
                    <label className={styles.inlineCheckRow}>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={e => setField('ativo', e.target.checked)}
                        style={{ accentColor: 'var(--purple)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      Ativo (visível para membros)
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Conteúdo ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Conteúdo</div>

                <div className={styles.formGroup}>
                  <label>Título *</label>
                  <input
                    className="input"
                    placeholder="Título exibido ao membro"
                    value={form.titulo}
                    onChange={e => setField('titulo', e.target.value)}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label>Descrição</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Texto descritivo (opcional)"
                    value={form.descricao}
                    onChange={e => setField('descricao', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* ── Mídia ── */}
              {(form.tipo === 'imagem' || form.tipo === 'indicacao' || form.tipo === 'video_youtube') && (
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Mídia</div>

                  {(form.tipo === 'imagem' || form.tipo === 'indicacao') && (
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label>Imagem</label>
                      {form.midia_url ? (
                        <div className={styles.imagePreviewWrap}>
                          <img src={form.midia_url} alt="Preview" className={styles.imagePreview} />
                          <button
                            type="button"
                            className={styles.removeImageBtn}
                            onClick={() => setField('midia_url', '')}
                          >
                            Remover imagem
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 13, marginBottom: 10 }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? 'Enviando…' : '📎 Fazer upload de imagem'}
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>ou cole a URL</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          </div>
                          <input
                            className="input"
                            placeholder="https://..."
                            value={form.midia_url}
                            onChange={e => setField('midia_url', e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {form.tipo === 'video_youtube' && (
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label>URL do YouTube *</label>
                      <input
                        className="input"
                        placeholder="https://youtu.be/... ou https://www.youtube.com/watch?v=..."
                        value={form.midia_url}
                        onChange={e => setField('midia_url', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Botão de ação ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Botão de ação (CTA)</div>

                <div className={styles.formGroup}>
                  <label>Texto do botão</label>
                  <input
                    className="input"
                    placeholder="Entendido!"
                    value={form.cta_label}
                    onChange={e => setField('cta_label', e.target.value)}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>URL (desktop)</label>
                    <input
                      className="input"
                      placeholder="https://... (opcional)"
                      value={form.cta_url}
                      onChange={e => setField('cta_url', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>URL (mobile)</label>
                    <input
                      className="input"
                      placeholder="https://... (opcional)"
                      value={form.cta_url_mobile}
                      onChange={e => setField('cta_url_mobile', e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                      Link alternativo para celular
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Veiculação ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Veiculação</div>

                <div className={styles.formGroup}>
                  <label>Frequência *</label>
                  <select
                    className="input"
                    value={form.veiculacao}
                    onChange={e => setField('veiculacao', e.target.value)}
                  >
                    <option value="uma_vez">Mostrar uma vez</option>
                    <option value="por_sessao">Por sessão</option>
                    <option value="sempre">Sempre (a cada acesso)</option>
                    <option value="a_cada_N_dias">A cada N dias</option>
                  </select>
                </div>

                {form.veiculacao === 'a_cada_N_dias' && (
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Número de dias *</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Ex: 7"
                      value={form.veiculacao_dias}
                      onChange={e => setField('veiculacao_dias', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* ── Público-alvo ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Público-alvo</div>

                <div className={styles.formGroup}>
                  <div className={styles.radioRow}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="publico_alvo"
                        value="todos"
                        checked={form.publico_alvo === 'todos'}
                        onChange={() => setField('publico_alvo', 'todos')}
                      />
                      Todos os membros
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="publico_alvo"
                        value="por_curso"
                        checked={form.publico_alvo === 'por_curso'}
                        onChange={() => setField('publico_alvo', 'por_curso')}
                      />
                      Por curso
                    </label>
                  </div>
                </div>

                {form.publico_alvo === 'por_curso' && (
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Cursos-alvo</label>
                    {form.cursos_alvo.length > 0 && (
                      <div className={styles.pillsRow}>
                        {form.cursos_alvo.map(c => (
                          <span key={c} className={styles.pill}>
                            {c}
                            <button
                              type="button"
                              className={styles.pillRemove}
                              onClick={() => removeCurso(c)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      className="input"
                      placeholder="Buscar e adicionar curso…"
                      value={cursoSearch}
                      onChange={e => setCursoSearch(e.target.value)}
                    />
                    {cursoSearch.trim() && filteredCursos.length > 0 && (
                      <div className={styles.cursoDropdown}>
                        {filteredCursos.slice(0, 20).map(c => (
                          <div
                            key={c}
                            className={styles.cursoOption}
                            onMouseDown={() => addCurso(c)}
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                    {cursoSearch.trim() && filteredCursos.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Nenhum curso encontrado</div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Agendamento ── */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Agendamento (opcional)</div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Data de início</label>
                    <input
                      className="input"
                      type="date"
                      value={form.data_inicio}
                      onChange={e => setField('data_inicio', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label>Data de fim</label>
                    <input
                      className="input"
                      type="date"
                      value={form.data_fim}
                      onChange={e => setField('data_fim', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar anúncio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text-1)' }}>
              Excluir anúncio?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
              O anúncio <strong>"{confirmDelete.nome}"</strong> será excluído permanentemente e não poderá ser recuperado.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                onClick={() => handleDelete(confirmDelete)}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
