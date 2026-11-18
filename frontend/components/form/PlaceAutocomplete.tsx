"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { inputClass } from "@/lib/ui";

export type PlaceSuggestion = { name: string; alias?: string };

type Props = {
  id: string;
  name: string;
  value: string;
  placeholder: string;
  /** Backend path, e.g. "/places/districts". */
  path: string;
  /** Extra query parameters — the parent level the list is scoped to. */
  scope?: Record<string, string>;
  /** How many suggestions to offer. */
  limit?: number;
  /** Nothing to pick from until the level above is filled. */
  disabled?: boolean;
  disabledHint?: string;
  /** Free typing. The value is kept, so a place we do not list is still allowed. */
  onType: (value: string) => void;
  /** A suggestion was chosen — the parent clears the levels below. */
  onPick: (value: string) => void;
};

// Every level answers with the same shape: { states | districts | cities:
// [{ name, alias? }] }. A bare string is still accepted so an older response
// does not blank the list.
const readList = (data: unknown): PlaceSuggestion[] => {
  if (!data || typeof data !== "object") return [];
  for (const key of ["cities", "districts", "states"] as const) {
    const list = (data as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    return list
      .map((item) => {
        if (typeof item === "string") return { name: item };
        if (item && typeof item === "object") {
          const row = item as { name?: unknown; alias?: unknown };
          if (typeof row.name === "string")
            return typeof row.alias === "string"
              ? { name: row.name, alias: row.alias }
              : { name: row.name };
        }
        return null;
      })
      .filter((item): item is PlaceSuggestion => item !== null);
  }
  return [];
};

type Anchor = { top: number; left: number; width: number; maxHeight: number };

const GUTTER = 8; // keeps the panel off the viewport edge at 320px
const ROOM = 160; // below this much space underneath, open upward instead

const PlaceAutocomplete = ({
  id,
  name,
  value,
  placeholder,
  path,
  scope,
  limit = 5,
  disabled,
  disabledHint,
  onType,
  onPick,
}: Props) => {
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const listId = useId();
  const field = useRef<HTMLInputElement | null>(null);
  const panel = useRef<HTMLUListElement | null>(null);
  // Set while a pick is being applied, so the effect below does not
  // immediately reopen the list with the value it just filled in.
  const justPicked = useRef(false);

  const scopeKey = JSON.stringify(scope ?? {});
  // Derived, so a disabled field shows nothing without an effect writing state.
  const options = disabled ? [] : items;
  // Set when the panel opens upward because there is no room beneath.
  const [flipped, setFlipped] = useState(false);

  // The panel is portalled to <body>, because .stack-card sets
  // `overflow: hidden` and `position: sticky` — inside the card the list is
  // clipped at the card's edge and no z-index can lift it out. Being in the
  // body means its position has to be measured and kept in step with the
  // input instead.
  const measure = useCallback(() => {
    const box = field.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - GUTTER;
    const above = box.top - GUTTER;
    const flip = below < ROOM && above > below;
    const width = Math.min(box.width, window.innerWidth - GUTTER * 2);
    setAnchor({
      top: flip ? box.top : box.bottom + 4,
      left: Math.max(GUTTER, Math.min(box.left, window.innerWidth - width - GUTTER)),
      width,
      maxHeight: Math.max(120, Math.min(288, flip ? above - 4 : below - 4)),
    });
    // When it opens upward the panel is pinned by its bottom edge, which the
    // style below handles via translateY.
    setFlipped(flip);
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    const onMove = () => measure();
    // capture:true so a scroll inside any ancestor repositions it, not just
    // the window's own scroll.
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  }, [open, measure, options.length]);

  useEffect(() => {
    // No setState in the effect body: `disabled` is handled by deriving the
    // rendered list below, and `loading` is set inside the timer callback,
    // which is already asynchronous.
    if (disabled || !open) return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    const controller = new AbortController();
    // A request per keystroke would be one per letter; wait for a pause.
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get(path, {
          params: { ...(scope ?? {}), q: value, limit },
          signal: controller.signal,
        })
        .then((response) => {
          setItems(readList(response.data));
          setActive(-1);
          setAsked(true);
        })
        .catch(() => {
          // A failed lookup must not block typing: the field still accepts
          // whatever the seller writes.
        })
        .finally(() => setLoading(false));
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, path, scopeKey, limit, disabled, open, scope]);

  // A click outside closes the list. The panel lives in <body>, so "outside"
  // has to exclude it explicitly as well as the input.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (field.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Keyboard navigation past the visible rows has to bring them into view,
  // or the highlight disappears under the panel's own scroll.
  useEffect(() => {
    if (active < 0) return;
    panel.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item: PlaceSuggestion) => {
    justPicked.current = true;
    onPick(item.name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && open && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    }
  };

  const empty = asked && !loading && options.length === 0 && value.trim() !== "";
  const showPanel = open && anchor !== null && (options.length > 0 || empty);

  const list = showPanel ? (
    <ul
      ref={panel}
      id={listId}
      role="listbox"
      // z-50: the panel is in <body>, so it has to clear the sticky page
      // chrome (z-20) and the floating map pill (z-40) while the field is
      // being typed into.
      className="fixed z-50 overflow-y-auto overscroll-contain rounded-[10px] border border-line bg-panel py-1 shadow-[0_18px_40px_#51116c26,0_2px_8px_#71228d14]"
      style={{
        top: anchor.top,
        left: anchor.left,
        width: anchor.width,
        maxHeight: anchor.maxHeight,
        transform: flipped ? "translateY(-100%)" : undefined,
      }}
    >
      {empty ? (
        <li className="px-3 py-2.5 text-[13px] leading-snug text-muted">
          No match in our list — you can type the name yourself.
        </li>
      ) : (
        options.map((item, index) => (
          <li
            key={`${item.name}-${index}`}
            id={`${listId}-${index}`}
            data-index={index}
            role="option"
            aria-selected={index === active}
            // mousedown, not click: the input's blur would otherwise close
            // the list before the click lands.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(item);
            }}
            onMouseEnter={() => setActive(index)}
            className={`flex min-h-10 cursor-pointer items-baseline gap-1.5 px-3 py-2 text-sm text-ink ${
              index === active ? "bg-accent-soft" : ""
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.alias ? (
              <span className="shrink-0 text-[11px] text-muted">
                “{item.alias}”
              </span>
            ) : null}
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <>
      <input
        ref={field}
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={disabled ? (disabledHint ?? placeholder) : placeholder}
        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-ground disabled:text-muted`}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 && options[active] ? `${listId}-${active}` : undefined
        }
        onChange={(event) => {
          onType(event.target.value);
          setAsked(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {typeof document !== "undefined" && list
        ? createPortal(list, document.body)
        : null}
    </>
  );
};

export default PlaceAutocomplete;
