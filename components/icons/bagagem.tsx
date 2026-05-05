import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { title?: string };

export function BolsaMochilaIcon({ title = "Bolsa/Mochila", ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-label={title} role="img" {...props}>
      <path
        d="M8 7a4 4 0 0 1 8 0v1h1.2A2.8 2.8 0 0 1 20 10.8V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8.2A2.8 2.8 0 0 1 6.8 8H8V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 8V7a2.5 2.5 0 1 1 5 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 13h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 16.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function MalaMaoIcon({ title = "Mala de mão", ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-label={title} role="img" {...props}>
      <path
        d="M7 9.5A2.5 2.5 0 0 1 9.5 7h5A2.5 2.5 0 0 1 17 9.5V19a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h.4A1.8 1.8 0 0 1 14 5.8V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function MalaGrandeIcon({ title = "Mala grande", ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-label={title} role="img" {...props}>
      <path
        d="M6.5 8.5A2.5 2.5 0 0 1 9 6h6a2.5 2.5 0 0 1 2.5 2.5V18a3 3 0 0 1-3 3H9.5a3 3 0 0 1-3-3V8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 6V5.2A2.2 2.2 0 0 1 11.7 3h.6A2.2 2.2 0 0 1 14.5 5.2V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 10.5v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M15 10.5v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M9.2 22.2a1 1 0 1 0 0-.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.8 22.2a1 1 0 1 0 0-.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

