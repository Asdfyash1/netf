'use client'

// Pre-generated stable particle positions (no random at runtime = no hydration issues)
const PARTICLE_POSITIONS = [
  { left: '10%', top: '20%', delay: '0s', duration: '18s' },
  { left: '25%', top: '80%', delay: '2s', duration: '22s' },
  { left: '40%', top: '15%', delay: '4s', duration: '16s' },
  { left: '55%', top: '60%', delay: '1s', duration: '20s' },
  { left: '70%', top: '35%', delay: '3s', duration: '24s' },
  { left: '85%', top: '75%', delay: '5s', duration: '19s' },
  { left: '15%', top: '50%', delay: '6s', duration: '21s' },
  { left: '30%', top: '10%', delay: '7s', duration: '17s' },
  { left: '50%', top: '90%', delay: '2.5s', duration: '23s' },
  { left: '65%', top: '25%', delay: '4.5s', duration: '18s' },
  { left: '80%', top: '55%', delay: '1.5s', duration: '20s' },
  { left: '5%', top: '65%', delay: '3.5s', duration: '22s' },
  { left: '20%', top: '40%', delay: '5.5s', duration: '16s' },
  { left: '45%', top: '5%', delay: '0.5s', duration: '19s' },
  { left: '60%', top: '70%', delay: '6.5s', duration: '21s' },
  { left: '75%', top: '30%', delay: '2.5s', duration: '17s' },
  { left: '90%', top: '85%', delay: '4s', duration: '23s' },
  { left: '35%', top: '55%', delay: '1s', duration: '18s' },
  { left: '95%', top: '10%', delay: '7.5s', duration: '20s' },
  { left: '12%', top: '88%', delay: '3s', duration: '22s' },
];

export default function ParticlesBg() {
  return (
    <div className="particles-bg" suppressHydrationWarning>
      {PARTICLE_POSITIONS.map((particle, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
          suppressHydrationWarning
        />
      ))}
    </div>
  )
}
