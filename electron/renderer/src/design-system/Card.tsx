import type { HTMLAttributes } from 'react'
import './card.css'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ds-card ${className ?? ''}`} {...props} />
}
