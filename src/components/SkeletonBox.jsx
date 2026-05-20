export default function SkeletonBox({ h = 20, w = '100%', r = 10, style = {} }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: 'var(--border)',
      backgroundImage: 'linear-gradient(90deg, var(--border) 25%, var(--card) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'sp-shimmer 1.4s infinite linear',
      flexShrink: 0,
      ...style,
    }} />
  )
}
