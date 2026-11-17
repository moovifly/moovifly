"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { documentoPlaceholder, formatDocumentoInput, type TipoDocumento } from "@/lib/format";

type DocumentoClienteFieldProps = {
  tipo: TipoDocumento;
  value: string;
  onTipoChange: (tipo: TipoDocumento) => void;
  onValueChange: (value: string) => void;
};

export function DocumentoClienteField({ tipo, value, onTipoChange, onValueChange }: DocumentoClienteFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="documento">Documento</Label>
      <div className="flex gap-2">
        <Select
          id="tipo_documento"
          aria-label="Tipo de documento"
          value={tipo}
          onChange={(e) => {
            const next = e.target.value as TipoDocumento;
            onTipoChange(next);
            onValueChange(formatDocumentoInput(value, next));
          }}
          className="w-[9rem] shrink-0 px-2.5"
        >
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="passaporte">Passaporte</option>
        </Select>
        <Input
          id="documento"
          value={value}
          onChange={(e) => onValueChange(formatDocumentoInput(e.target.value, tipo))}
          placeholder={documentoPlaceholder(tipo)}
          autoComplete="off"
          inputMode={tipo === "cpf" ? "numeric" : "text"}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}
