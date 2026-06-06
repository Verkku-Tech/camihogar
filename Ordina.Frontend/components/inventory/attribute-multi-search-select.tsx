"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { AttributeValue } from "@/lib/storage";

export type AttributeOption = {
  value: string;
  label: string;
};

export function buildAttributeOptions(
  values: (string | AttributeValue)[] | undefined,
  getValueString: (value: string | AttributeValue) => string,
  getValueLabel: (value: string | AttributeValue) => string,
): AttributeOption[] {
  if (!values?.length) return [];

  return values
    .map((item) => {
      const value = getValueString(item);
      const label = getValueLabel(item);
      if (!value || value.trim() === "" || value === "unknown") return null;
      return { value, label: label.trim() !== "" ? label : value };
    })
    .filter((opt): opt is AttributeOption => opt !== null)
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesProximity(label: string, search: string): boolean {
  const normSearch = normalizeText(search);
  if (!normSearch) return true;

  const normLabel = normalizeText(label);
  if (normLabel.includes(normSearch)) return true;

  const words = normSearch.split(/\s+/).filter(Boolean);
  return words.every((word) => normLabel.includes(word));
}

function proximityScore(label: string, search: string): number {
  const normSearch = normalizeText(search);
  if (!normSearch) return 0;

  const normLabel = normalizeText(label);
  if (normLabel === normSearch) return 100;
  if (normLabel.startsWith(normSearch)) return 80;
  if (normLabel.includes(normSearch)) return 60;

  const words = normSearch.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => normLabel.includes(word))) {
    return 40;
  }

  return 0;
}

function filterAndSortOptions(
  options: AttributeOption[],
  search: string,
): AttributeOption[] {
  const filtered = options.filter((opt) => matchesProximity(opt.label, search));
  const normSearch = normalizeText(search);

  if (!normSearch) return filtered;

  return [...filtered].sort(
    (a, b) => proximityScore(b.label, search) - proximityScore(a.label, search),
  );
}

type AttributeSearchSelectBaseProps = {
  options: AttributeOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
};

type AttributeSingleSearchSelectProps = AttributeSearchSelectBaseProps & {
  mode?: "single";
  value?: string;
  onChange: (value: string | undefined) => void;
};

type AttributeMultiSearchSelectProps = AttributeSearchSelectBaseProps & {
  mode: "multiple";
  selectedValues: string[];
  onChange: (values: string[]) => void;
  maxSelections?: number;
};

export type AttributeSearchSelectProps =
  | AttributeSingleSearchSelectProps
  | AttributeMultiSearchSelectProps;

function AttributeSearchSelect(props: AttributeSearchSelectProps) {
  const mode = props.mode ?? "single";
  const {
    options,
    placeholder = "Seleccione una opción",
    searchPlaceholder = "Escribe para buscar...",
    disabled = false,
    className,
    emptyMessage = "No se encontraron opciones.",
  } = props;

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const maxSelections =
    mode === "multiple" ? (props.maxSelections ?? Infinity) : 1;
  const selectedValues =
    mode === "multiple"
      ? props.selectedValues
      : props.value
        ? [props.value]
        : [];

  const isMaxReached =
    mode === "multiple" &&
    maxSelections !== Infinity &&
    selectedValues.length >= maxSelections;

  const availableOptions =
    mode === "multiple"
      ? options.filter((opt) => !selectedValues.includes(opt.value))
      : options;

  const displayOptions = filterAndSortOptions(availableOptions, searchTerm);

  const selectedLabel =
    mode === "single" && props.value
      ? (options.find((o) => o.value === props.value)?.label ?? props.value)
      : null;

  const closePanel = () => {
    setOpen(false);
    setSearchTerm("");
  };

  const selectSingle = (value: string) => {
    if (mode !== "single") return;
    props.onChange(value);
    closePanel();
  };

  const addMultiple = (value: string) => {
    if (mode !== "multiple") return;
    if (selectedValues.includes(value)) return;

    if (maxSelections !== Infinity && selectedValues.length >= maxSelections) {
      toast.error(
        `Solo puedes seleccionar máximo ${maxSelections} opción${maxSelections > 1 ? "es" : ""}`,
      );
      return;
    }

    props.onChange([...selectedValues, value]);
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  const removeMultiple = (value: string) => {
    if (mode !== "multiple") return;
    props.onChange(selectedValues.filter((v) => v !== value));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const triggerDisabled = disabled || isMaxReached;

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <div className="relative">
        <button
          type="button"
          disabled={triggerDisabled}
          onClick={() => {
            if (triggerDisabled) return;
            setOpen((prev) => !prev);
          }}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-ring ring-offset-2",
          )}
        >
          <span
            className={cn(
              "truncate text-left",
              !selectedLabel && mode === "single" && "text-muted-foreground",
              mode === "multiple" &&
                selectedValues.length === 0 &&
                "text-muted-foreground",
            )}
          >
            {isMaxReached
              ? `Máximo alcanzado (${maxSelections})`
              : mode === "single"
                ? selectedLabel || placeholder
                : selectedValues.length > 0
                  ? `${selectedValues.length} seleccionada${selectedValues.length > 1 ? "s" : ""}`
                  : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && !triggerDisabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b p-2">
            <Input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9"
              aria-label={searchPlaceholder}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  searchInputRef.current?.focus();
                }}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>

          <div
            className="max-h-60 overflow-y-auto p-1"
            role="listbox"
            aria-label="Opciones disponibles"
          >
            {displayOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              displayOptions.map((opt) => {
                const isSelected =
                  mode === "single" && props.value === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      mode === "single"
                        ? selectSingle(opt.value)
                        : addMultiple(opt.value)
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/60",
                    )}
                  >
                    {mode === "single" && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected && <Check className="h-4 w-4" />}
                      </span>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {!searchTerm.trim() && displayOptions.length > 0 && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Desplázate para ver más opciones o escribe para filtrar.
            </p>
          )}
          </div>
        )}
      </div>

      {mode === "multiple" && selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((val) => {
            const option = options.find((o) => o.value === val);
            const displayLabel = option?.label ?? val;
            return (
              <Badge
                key={val}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => removeMultiple(val)}
              >
                {displayLabel} ×
              </Badge>
            );
          })}
        </div>
      )}

      {mode === "multiple" && maxSelections !== Infinity && (
        <p className="text-xs text-muted-foreground">
          Máximo {maxSelections} selección{maxSelections > 1 ? "es" : ""}{" "}
          permitida{maxSelections > 1 ? "s" : ""}
          {selectedValues.length > 0 &&
            ` (${selectedValues.length}/${maxSelections})`}
        </p>
      )}
    </div>
  );
}

export function AttributeSingleSearchSelect(
  props: Omit<AttributeSingleSearchSelectProps, "mode">,
) {
  return <AttributeSearchSelect mode="single" {...props} />;
}

export function AttributeMultiSearchSelect(
  props: Omit<AttributeMultiSearchSelectProps, "mode">,
) {
  return <AttributeSearchSelect mode="multiple" {...props} />;
}
