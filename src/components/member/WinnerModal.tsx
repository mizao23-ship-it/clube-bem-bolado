import { useEffect, useRef } from 'react'
import styles from './WinnerModal.module.css'

interface Props {
  prizeName: string
  onClose: () => void
}

export default function WinnerModal({ prizeName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return
    const canvas = canvasEl

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#7E00E5', '#a78bfa', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#f97316']

    interface Particle {
      x: number; y: number
      vx: number; vy: number
      color: string
      size: number
      alpha: number
      decay: number
      rotation: number
      rotationSpeed: number
    }

    const particles: Particle[] = []

    function burst(x: number, y: number) {
      for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 6
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 4 + Math.random() * 6,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.01,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
        })
      }
    }

    // Launch 3 bursts at different positions
    const positions = [
      [canvas.width * 0.25, canvas.height * 0.35],
      [canvas.width * 0.75, canvas.height * 0.3],
      [canvas.width * 0.5, canvas.height * 0.25],
    ]

    let burstIdx = 0
    const burstInterval = setInterval(() => {
      if (burstIdx < positions.length) {
        burst(positions[burstIdx][0], positions[burstIdx][1])
        burstIdx++
      }
    }, 300)

    // Repeat bursts every 2.5s
    const repeatInterval = setInterval(() => {
      burstIdx = 0
      const bI = setInterval(() => {
        if (burstIdx < positions.length) {
          const jitter = (Math.random() - 0.5) * 80
          burst(positions[burstIdx][0] + jitter, positions[burstIdx][1] + jitter)
          burstIdx++
        } else {
          clearInterval(bI)
        }
      }, 300)
    }, 2500)

    let animId: number
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.12  // gravity
        p.vx *= 0.98
        p.alpha -= p.decay
        p.rotation += p.rotationSpeed
        if (p.alpha <= 0) { particles.splice(i, 1); continue }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5)
        ctx.restore()
      }
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      clearInterval(burstInterval)
      clearInterval(repeatInterval)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.trophy}>🏆</div>
        <div className={styles.winLabel}>Parabéns! Você ganhou!</div>
        <div className={styles.prizeName}>{prizeName}</div>
        <div className={styles.emailMsg}>
          Você receberá os detalhes do prêmio por e-mail em breve.
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
