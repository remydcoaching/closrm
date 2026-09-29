import type { ButtonHTMLAttributes } from 'react'
import './button.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'secondary', className, ...props }: ButtonProps) {
  return <button className={`ds-button ds-button--${variant} ${className ?? ''}`} {...props} />
}
