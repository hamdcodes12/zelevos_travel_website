import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MapPin, Plane, Check, AlertCircle } from "lucide-react";
import { searchAirports, getAirportByCode, type Airport } from "@/lib/airports";

interface AirportAutocompleteProps {
  id: string;
  value: string; // IATA code or city code
  onChange: (iata: string) => void;
  excludeIata?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function AirportAutocomplete({
  id,
  value,
  onChange,
  excludeIata,
  placeholder = "Search city, airport or code...",
}: AirportAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal display query when external value changes
  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    const airport = getAirportByCode(value);
    if (airport) {
      setQuery(`${airport.city} (${airport.iata})`);
    } else {
      setQuery(value);
    }
  }, [value]);

  const results = searchAirports(query.replace(/\s*\([A-Z0-9]{3}\).*/i, ""), excludeIata);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset query back to current value display if user clicked away without selecting
        const airport = getAirportByCode(value);
        if (airport) {
          setQuery(`${airport.city} (${airport.iata})`);
        } else {
          setQuery(value || "");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const selectAirport = (airport: Airport) => {
    if (excludeIata && airport.iata === excludeIata.toUpperCase()) {
      return; // Disallow selecting the same airport
    }
    onChange(airport.iata);
    setQuery(`${airport.city} (${airport.iata})`);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + results.length) % (results.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightIndex]) {
        selectAirport(results[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%" }}>
        <MapPin size={15} style={{ flexShrink: 0, color: "var(--blue)" }} />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setIsOpen(true);
            setHighlightIndex(0);
            // If user typed an exact 3-letter IATA code, update parent
            if (next.trim().length === 3) {
              const exact = getAirportByCode(next.trim());
              if (exact) {
                onChange(exact.iata);
              }
            } else if (!next.trim()) {
              onChange("");
            }
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            minWidth: 0,
            border: 0,
            outline: 0,
            color: "var(--text)",
            background: "transparent",
            fontSize: "11px",
            fontWeight: 700,
          }}
        />
      </div>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            minWidth: "260px",
            maxHeight: "260px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "9px",
            boxShadow: "0 12px 32px rgba(16, 24, 40, 0.16)",
            padding: "5px",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={13} />
              <span>No airports found</span>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = item.iata === value?.toUpperCase();
              const isHighlighted = index === highlightIndex;
              const isExcluded = excludeIata && item.iata === excludeIata.toUpperCase();

              return (
                <div
                  key={item.iata}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => selectAirport(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: isExcluded ? "not-allowed" : "pointer",
                    background: isHighlighted ? "var(--soft)" : "transparent",
                    opacity: isExcluded ? 0.45 : 1,
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--text)" }}>{item.city}</strong>
                      {isSelected && <Check size={12} style={{ color: "var(--success)" }} />}
                      {isExcluded && <span style={{ fontSize: "9px", color: "#e11d48", fontWeight: 700 }}>Already selected</span>}
                    </div>
                    <div
                      style={{
                        fontSize: "9.5px",
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "190px",
                      }}
                    >
                      {item.name} · {item.country}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: isSelected ? "var(--blue)" : "#eef2fd",
                      color: isSelected ? "#ffffff" : "var(--blue)",
                      letterSpacing: "0.05em",
                      marginLeft: "8px",
                      flexShrink: 0,
                    }}
                  >
                    {item.iata}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
