import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import './input.css'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ds-input" {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="ds-input ds-textarea" {...props} />
}
