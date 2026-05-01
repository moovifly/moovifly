import type { AnchorHTMLAttributes } from "react";

import { publicUrlForPath } from "@/lib/public-site-url";

/**
 * Links internos do backoffice com navegação completa (documento inteiro).
 * Em hospedagem estática (Next export na Hostinger), o roteamento client-side
 * do App Router pode solicitar payloads RSC `.txt` por segmento inexistentes
 * ou com caminho errado, gerando 404; usar `<a>` evita esse fluxo.
 *
 * Com NEXT_PUBLIC_APP_URL em produção, hrefs apontam sempre para a origem canônica
 * (evita perder sessão Supabase entre www e apex).
 */
export function BackofficeLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props;
  const resolved = typeof href === "string" ? publicUrlForPath(href) : href;
  return (
    <a href={resolved} {...rest}>
      {children}
    </a>
  );
}
