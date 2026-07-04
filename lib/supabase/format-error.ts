const CONSTRAINT_MESSAGES: Record<string, string> = {
  vendas_numero_venda_key:
    "Conflito ao gerar o número da venda. Clique em salvar uma vez e aguarde. Se a venda não aparecer na listagem, recarregue a página antes de tentar de novo.",
  clientes_cpf_key: "Este CPF já está cadastrado para outro cliente.",
  orcamentos_numero_orcamento_key: "Conflito ao gerar o número do orçamento. Tente salvar novamente.",
};

function extractConstraintName(text: string): string | null {
  const quoted = text.match(/unique constraint "([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const unquoted = text.match(/unique constraint (\S+)/i);
  return unquoted?.[1]?.replace(/"/g, "") ?? null;
}

function friendlyMessage(raw: string): string | null {
  const constraint = extractConstraintName(raw);
  if (constraint && CONSTRAINT_MESSAGES[constraint]) {
    return CONSTRAINT_MESSAGES[constraint];
  }
  if (/duplicate key value violates unique constraint/i.test(raw)) {
    return "Registro duplicado. Verifique se os dados já existem no sistema e tente novamente.";
  }
  if (/violates foreign key constraint/i.test(raw)) {
    return "Referência inválida. Algum dado vinculado não existe mais ou foi removido.";
  }
  if (/violates check constraint/i.test(raw)) {
    return "Algum campo está com valor inválido. Revise o formulário e tente novamente.";
  }
  if (/null value in column/i.test(raw)) {
    return "Campo obrigatório não preenchido. Revise o formulário e tente novamente.";
  }
  return null;
}

/** Mensagem legível para PostgrestError / erro genérico (evita "[object Object]" no toast). */
export function formatSupabaseError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const o = err as { message?: string; details?: string; hint?: string; code?: string };
    const rawParts = [o.message, o.details, o.hint].filter((s): s is string => typeof s === "string" && s.length > 0);
    const raw = rawParts.join(" — ");
    const friendly = friendlyMessage(raw);
    if (friendly) return friendly;
    if (raw.length) return raw;
  }
  return err instanceof Error ? err.message : String(err);
}
