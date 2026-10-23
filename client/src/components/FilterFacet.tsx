import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { normalizeText } from "@shared/normalization";

type Option = { value: string; label: string; count?: number };
type FilterFacetProps = {
  label: string;
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  maxHeight?: number;
};

export default function FilterFacet({
  label,
  options,
  values,
  onChange,
  placeholder,
  searchable = true,
  maxHeight = 210,
}: FilterFacetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabels = options
    .filter(item => values.includes(item.value))
    .map(item => item.label);
  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return options.filter(
      option => !normalized || normalizeText(option.label).includes(normalized)
    );
  }, [options, query]);
  const toggle = (value: string) =>
    onChange(
      values.includes(value)
        ? values.filter(item => item !== value)
        : [...values, value]
    );
  return (
    <div className="facet-picker">
      <button
        className="facet-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span>
          {selectedLabels.length
            ? `${selectedLabels.slice(0, 2).join(", ")}${selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ""}`
            : (placeholder ?? `Seleccionar ${label.toLowerCase()}`)}
        </span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          className="facet-popover"
          role="group"
          aria-label={label}
          style={{ maxHeight }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setOpen(false);
              event.stopPropagation();
            }
          }}
        >
          {searchable && (
            <div className="facet-search">
              <input
                autoFocus
                aria-label={`Buscar ${label}`}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="inline-empty">No hay opciones con ese nombre.</div>
          ) : (
            <div className="facet-options">
              {filtered.map(option => (
                <label className="facet-option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={values.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <small style={{ marginLeft: "auto", color: "#99a5a7" }}>
                      {option.count}
                    </small>
                  )}
                </label>
              ))}
            </div>
          )}
          <div className="facet-footer">
            <span>
              {values.length} seleccionado{values.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="button button-quiet button-small"
              onClick={() => {
                onChange([]);
                setQuery("");
              }}
            >
              <X size={13} /> Limpiar
            </button>
            <button
              type="button"
              className="facet-done"
              onClick={() => setOpen(false)}
            >
              <Check size={13} /> Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
