import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

type Props = Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  allowEmpty?: boolean;
};

function normalizeCurrencyText(text: string) {
  const digits = text.replace(/\D/g, "");
  if (!digits) return { digits: "", value: 0 };
  const cents = Number(digits);
  return { digits, value: Number.isFinite(cents) ? cents / 100 : 0 };
}

function fmt(value: number) {
  // Intl pode usar NBSP; padroniza para espaço comum.
  return formatCurrency(value).replace(/\u00A0/g, " ");
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, allowEmpty = false, placeholder, ...props }, ref) => {
    const display = React.useMemo(() => {
      if (value == null) return "";
      return fmt(value);
    }, [value]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? "R$ 0,00"}
        value={display}
        onChange={(e) => {
          const next = e.target.value;
          const { digits, value: numeric } = normalizeCurrencyText(next);
          if (!digits && allowEmpty) {
            onValueChange(null);
            return;
          }
          onValueChange(numeric);
        }}
        {...props}
      />
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";

