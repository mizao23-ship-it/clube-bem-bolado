import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import MetricCard from '@/components/admin/MetricCard'
import HBarChart from '@/components/admin/HBarChart'
import styles from './Dashboard.module.css'

interface FeedItem { icon: string; text: string; time: string; cls: string }

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [total, setTotal] = useState(0)
  const [ativos, setAtivos] = useState(0)
  const [sorteiosAtivos, setSorteiosAtivos] = useState(0)
  const [experienciasAtivas, setExperienciasAtivas] = useState(0)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [sorteios, setSorteios] = useState<{ premio: string; participantes: number; encerramento: string | null; status: string; id: number }[]>([])
  const [expPopularity, setExpPopularity] = useState<{ label: string; value: number }[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [
      { count: totalCount },
      { count: ativosCount },
      { data: sorteiosData },
      { data: recentUsers },
      { data: recentWinners },
      { data: allParts },
      { data: allExps },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
      supabase.from('sorteios').select('id,premio,status,encerramento').eq('status', 'ativo'),
      supabase.from('users').select('nome,created_at').order('created_at', { ascending: false }).limit(10),
      supabase
        .from('sorteio_winners')
        .select('resultado_at, users(nome), sorteios(premio)')
        .order('resultado_at', { ascending: false })
        .limit(10),
      supabase.from('participations').select('experience_id'),
      supabase.from('experiences').select('id, name').eq('active', true),
    ])

    setTotal(totalCount ?? 0)
    setAtivos(ativosCount ?? 0)
    setSorteiosAtivos(sorteiosData?.length ?? 0)
    setExperienciasAtivas(allExps?.length ?? 0)
    setSorteios(
      (sorteiosData ?? []).map(s => ({
        ...s,
        participantes: 0,
      }))
    )

    const signupItems: (FeedItem & { _at: string })[] = (recentUsers ?? []).map(u => ({
      cls: 'fi-signup',
      icon: '👤',
      text: `${u.nome} se cadastrou`,
      time: timeAgo(u.created_at),
      _at: u.created_at,
    }))

    const winnerItems: (FeedItem & { _at: string })[] = ((recentWinners ?? []) as any[]).map(w => ({
      cls: 'fi-winner',
      icon: '🏆',
      text: `${w.users?.nome ?? 'Membro'} ganhou ${w.sorteios?.premio ?? 'um sorteio'}`,
      time: timeAgo(w.resultado_at),
      _at: w.resultado_at,
    }))

    const merged = [...signupItems, ...winnerItems]
      .sort((a, b) => new Date(b._at).getTime() - new Date(a._at).getTime())
      .slice(0, 10)

    setFeed(merged)

    // Experience popularity
    const countMap: Record<string, number> = {}
    for (const p of allParts ?? []) {
      countMap[p.experience_id] = (countMap[p.experience_id] ?? 0) + 1
    }
    const popularity = (allExps ?? [])
      .map(e => ({ label: e.name, value: countMap[e.id] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    setExpPopularity(popularity)
  }

  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral do clube · atualizado agora</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/usuarios')}>+ Novo membro</button>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <MetricCard icon="🏆" label="Membros ativos" value={ativos.toLocaleString('pt-BR')} change="↑ 12% este mês" changeType="up" colorClass="purple" />
        <MetricCard icon="✨" label="Total de membros" value={total.toLocaleString('pt-BR')} colorClass="green" />
        <MetricCard icon="🎯" label="Sorteios ativos" value={sorteiosAtivos} change="Ver todos →" colorClass="amber" onChangeClick={() => navigate('/admin/sorteios')} />
        <MetricCard icon="🌟" label="Experiências ativas" value={experienciasAtivas} change="Ver todas →" colorClass="purple" onChangeClick={() => navigate('/admin/sorteios')} />
      </div>

      <div className={styles.bottomGrid}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div>
              <div className="card-title">Experiências mais populares</div>
              <div className="card-sub">Por número de inscrições</div>
            </div>
          </div>
          <HBarChart items={expPopularity} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head"><div className="card-title">Atividade recente</div></div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {feed.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Aguardando atividade…</div>
            ) : (
              feed.map((item, i) => (
                <div key={i} className={styles.feedItem}>
                  <div className={`${styles.feedIcon} ${styles[item.cls]}`}>{item.icon}</div>
                  <div className={styles.feedText}>{item.text}</div>
                  <div className={styles.feedTime}>{item.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Sorteios em andamento</div>
          <button className="btn" onClick={() => navigate('/admin/sorteios')}>Ver todos →</button>
        </div>
        <table>
          <thead>
            <tr><th>Prêmio</th><th>Encerramento</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {sorteios.map(s => (
              <tr key={s.id}>
                <td><strong>{s.premio}</strong></td>
                <td style={{ color: 'var(--text-2)' }}>{s.encerramento ?? '—'}</td>
                <td><span className="badge badge-green"><span className="dot" />Ativo</span></td>
                <td><button className="btn" onClick={() => navigate('/admin/sorteios')}>Ver</button></td>
              </tr>
            ))}
            {sorteios.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Nenhum sorteio ativo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
