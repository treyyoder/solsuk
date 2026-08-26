import { useMemo } from 'react'
import { sunGranulationDataUrl } from '../utils/sunTexture'

/** The SOLSUK wordmark: S/L sun-yellow, O a rotating hyper-real sun disc, SUK a green→purple gradient. */
export function SolsukLogo({ className = '' }: { className?: string }) {
  const tex = useMemo(() => sunGranulationDataUrl(96), [])
  return (
    <span role="img" aria-label="SOLSUK" className={`inline-flex items-baseline ${className}`}>
      <span aria-hidden="true" className="sol-text">
        S
      </span>
      <span aria-hidden="true" className="solsuk-sun-letter">
        <span className="solsuk-sun-letter__surface" style={{ backgroundImage: `url(${tex})` }} />
        <span className="solsuk-sun-letter__limb" />
        <span className="solsuk-sun-letter__flare" />
      </span>
      <span aria-hidden="true" className="sol-text">
        L
      </span>
      <span aria-hidden="true" className="solsuk-gradient-suk">
        SUK
      </span>
    </span>
  )
}
