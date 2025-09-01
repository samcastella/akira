"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Save, X, Search } from "lucide-react";

/* =========
   Tipos
   ========= */
export type Food = {
  id: string;
  name: string;
  kcalPer100g: number;
};

export type MealItem = {
  id: string;
  foodId?: string;
  customName?: string;
  kcalPer100g: number;
  grams: number;
};

export type MealResult = {
  id: string;
  name: string;
  items: MealItem[];
  totalKcal: number;
  createdAt: number;
};

/* =========
   Dataset local
   ========= */
const BASE_FOODS: Food[] = [
  { id: "arroz", name: "Arroz blanco crudo", kcalPer100g: 357 },
  { id: "arroz_cocido", name: "Arroz blanco cocido", kcalPer100g: 130 },
  { id: "pollo_pechuga", name: "Pechuga de pollo", kcalPer100g: 165 },
  { id: "aceite_oliva", name: "Aceite de oliva", kcalPer100g: 884 },
  { id: "cebolla", name: "Cebolla", kcalPer100g: 40 },
  { id: "tomate", name: "Tomate", kcalPer100g: 18 },
  { id: "pimiento_rojo", name: "Pimiento rojo", kcalPer100g: 31 },
  { id: "guisantes", name: "Guisantes", kcalPer100g: 81 },
  { id: "calamar", name: "Calamar", kcalPer100g: 92 },
  { id: "gamba", name: "Gamba", kcalPer100g: 99 },
  { id: "conejo", name: "Conejo", kcalPer100g: 173 },
  { id: "salmon", name: "Salmón", kcalPer100g: 208 },
  { id: "atun", name: "Atún", kcalPer100g: 144 },
  { id: "huevo", name: "Huevo", kcalPer100g: 155 },
  { id: "patata", name: "Patata", kcalPer100g: 77 },
  { id: "zanahoria", name: "Zanahoria", kcalPer100g: 41 },
  { id: "pasta_cocida", name: "Pasta cocida", kcalPer100g: 158 },
  { id: "pan", name: "Pan blanco", kcalPer100g: 265 },
  { id: "lentejas_cocidas", name: "Lentejas cocidas", kcalPer100g: 116 },
  { id: "garbanzos_cocidos", name: "Garbanzos cocidos", kcalPer100g: 164 },
  { id: "brocoli", name: "Brócoli", kcalPer100g: 34 },
  { id: "calabacin", name: "Calabacín", kcalPer100g: 17 },
  { id: "champi", name: "Champiñón", kcalPer100g: 22 },
  { id: "espinacas", name: "Espinacas", kcalPer100g: 23 },
  { id: "maiz", name: "Maíz dulce", kcalPer100g: 86 },
  { id: "chocolate", name: "Chocolate negro 70%", kcalPer100g: 579 },
  { id: "pavo", name: "Pavo (pechuga)", kcalPer100g: 135 },
  { id: "ternera", name: "Ternera magra", kcalPer100g: 217 },
  { id: "cerdo", name: "Cerdo (lomo)", kcalPer100g: 242 },
  { id: "atun_lata", name: "Atún enlatado al natural", kcalPer100g: 116 },
  { id: "yogur", name: "Yogur natural", kcalPer100g: 61 },
  { id: "manzana", name: "Manzana", kcalPer100g: 52 },
  { id: "platano", name: "Plátano", kcalPer100g: 89 },
  { id: "avena", name: "Avena", kcalPer100g: 389 },
  { id: "queso", name: "Queso semi-curado", kcalPer100g: 402 },
];

/* =========
   Utils
   ========= */
const uid = () => Math.random().toString(36).slice(2);
const clampNum = (n: number, min = 0, max = 1_000_000) => Math.min(max, Math.max(min, n));
const formatKcal = (n: number) => `${Math.round(n)} kcal`;

/* =========
   Autocomplete compacto
   ========= */
function Autocomplete({
  value,
  onChange,
  onPick,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (food: Food) => void;
  options: Food[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-black">
        <Search size={14} className="opacity-70" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full outline-none text-sm"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--muted)]">Sin resultados</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm">{o.name}</span>
                <span className="text-xs text-[var(--muted)]">{o.kcalPer100g} kcal/100g</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* =========
   Fila de ingrediente (una sola línea)
   ========= */
function IngredientRow({
  foods,
  value,
  onChange,
  onRemove,
}: {
  foods: Food[];
  value: MealItem;
  onChange: (next: MealItem) => void;
  onRemove: () => void;
}) {
  const displayName = value.customName ?? foods.find((f) => f.id === value.foodId)?.name ?? "";
  const [query, setQuery] = useState(displayName);

  useEffect(() => {
    setQuery(displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.foodId, value.customName]);

  const kcal = useMemo(() => (value.grams * value.kcalPer100g) / 100, [value.grams, value.kcalPer100g]);

  return (
    <div className="grid grid-cols-[1fr,82px,96px,90px,36px] items-center gap-2">
      {/* Ingrediente (autocomplete). Escribir = nombre personalizado */}
      <Autocomplete
        value={query}
        onChange={(v) => {
          setQuery(v);
          onChange({ ...value, customName: v || undefined, foodId: undefined });
        }}
        onPick={(food) => {
          onChange({ ...value, foodId: food.id, customName: undefined, kcalPer100g: food.kcalPer100g });
          setQuery(food.name);
        }}
        options={foods}
        placeholder="Ingrediente (ej. Arroz)"
      />

      {/* Gramos */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-right text-sm"
          value={value.grams}
          onChange={(e) => onChange({ ...value, grams: clampNum(parseFloat(e.target.value || "0"), 0, 100000) })}
          placeholder="gr"
          aria-label="Gramos"
        />
        <span className="text-xs text-[var(--muted)]">g</span>
      </div>

      {/* kcal / 100g (editable y compacto) */}
      <input
        type="number"
        inputMode="numeric"
        className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-right text-sm"
        value={value.kcalPer100g}
        onChange={(e) =>
          onChange({ ...value, kcalPer100g: clampNum(parseFloat(e.target.value || "0"), 0, 2000) })
        }
        placeholder="kcal/100g"
        aria-label="kcal por 100g"
        title="Ajusta el valor si es un ingrediente personalizado o quieres afinar"
      />

      {/* kcal calculadas */}
      <div className="text-right text-sm font-medium tabular-nums">{formatKcal(kcal)}</div>

      {/* Eliminar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center rounded-lg border border-[var(--line)] p-2 hover:bg-red-50 hover:text-red-600"
          title="Eliminar ingrediente"
          aria-label="Eliminar ingrediente"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* =========
   Modal principal (compacto y contenido recogido)
   ========= */
export default function CalorieCalculatorModal({
  isOpen,
  onClose,
  onSave,
  presetFoods,
  initialName = "",
  initialItems,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meal: MealResult) => void;
  presetFoods?: Food[];
  initialName?: string;
  initialItems?: MealItem[];
}) {
  const foods = useMemo(() => (presetFoods && presetFoods.length ? presetFoods : BASE_FOODS), [presetFoods]);

  const [mealName, setMealName] = useState(initialName);
  const [items, setItems] = useState<MealItem[]>(
    initialItems && initialItems.length
      ? initialItems
      : [{ id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 }]
  );

  useEffect(() => {
    if (isOpen) {
      setMealName(initialName);
      setItems(
        initialItems && initialItems.length
          ? initialItems
          : [{ id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 }]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totals = useMemo(() => {
    const totalKcal = items.reduce((acc, it) => acc + (it.grams * it.kcalPer100g) / 100, 0);
    const totalGrams = items.reduce((acc, it) => acc + it.grams, 0);
    return { totalKcal, totalGrams };
  }, [items]);

  function addRow() {
    setItems((prev) => [...prev, { id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 }]);
  }
  function removeRow(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }
  function updateRow(id: string, next: MealItem) {
    setItems((prev) => prev.map((x) => (x.id === id ? next : x)));
  }
  function handleSave() {
    const clean = items.filter((it) => (it.customName || it.foodId) && it.grams > 0 && it.kcalPer100g > 0);
    const name = mealName.trim() || "Comida sin nombre";
    const payload: MealResult = {
      id: uid(),
      name,
      items: clean,
      totalKcal: Math.round(totals.totalKcal),
      createdAt: Date.now(),
    };
    onSave(payload);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Overlay */}
      <button
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
        onClick={onClose}
      />

      {/* Modal compacto */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-3 sm:p-4 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold">Calculadora de calorías</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] p-2 hover:bg-gray-50"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nombre de la comida */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nombre de la comida</label>
          <input
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="Ej. Paella"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
          />
        </div>

        {/* Tabla de ingredientes (compacta) */}
        <div className="rounded-xl border border-[var(--line)] p-3">
          <div className="grid grid-cols-[1fr,82px,96px,90px,36px] gap-2 px-1 pb-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            <div>Ingrediente</div>
            <div className="text-right">g</div>
            <div className="text-right">kcal/100g</div>
            <div className="text-right">kcal</div>
            <div></div>
          </div>

          <div className="flex flex-col gap-2.5">
            {items.map((it) => (
              <IngredientRow
                key={it.id}
                foods={foods}
                value={it}
                onChange={(next) => updateRow(it.id, next)}
                onRemove={() => removeRow(it.id)}
              />
            ))}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <Plus size={16} /> Añadir ingrediente
            </button>
          </div>
        </div>

        {/* Totales */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--muted)]">
            <span className="mr-4">Peso total: {Math.round(totals.totalGrams)} g</span>
            <span>kcal totales: <strong>{Math.round(totals.totalKcal)}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:opacity-90 active:opacity-80"
              title="Añadir la comida al registro"
            >
              <Save size={16} /> Añadir al registro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
