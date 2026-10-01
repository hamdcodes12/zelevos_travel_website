import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, MapPin, Search, AlertCircle } from "lucide-react";

type LocationSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type LocationAutocompleteProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder = "Search a city, hotel or landmark...",
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(trimmed)}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = await response.json() as { results?: LocationSuggestion[] };
        if (!response.ok) {
          throw new Error("Location search unavailable");
        }
        if (currentRequest === requestId.current) {
          setSuggestions(payload.results || []);
          setMapsUnavailable(false);
        }
      } catch {
        if (!controller.signal.aborted && currentRequest === requestId.current) {
          setSuggestions([]);
          setMapsUnavailable(true);
        }
      } finally {
        if (!controller.signal.aborted && currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.description);
    onChange(suggestion.description);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && suggestions[0]) {
      event.preventDefault();
      selectSuggestion(suggestions[0]);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%" }}>
        <MapPin size={15} style={{ flexShrink: 0, color: "var(--blue)" }} />
        <input
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
            setIsOpen(true);
            setMapsUnavailable(false);
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
        {loading ? <Search size={13} className="animate-spin" style={{ color: "var(--muted)" }} /> : null}
      </div>

      {isOpen && (suggestions.length > 0 || mapsUnavailable) && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            minWidth: "260px",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "9px",
            boxShadow: "0 12px 32px rgba(16, 24, 40, 0.16)",
            padding: "5px",
          }}
        >
          {mapsUnavailable ? (
            <div style={{ padding: "10px 12px", fontSize: "11px", color: "var(--muted)", display: "flex", gap: "6px" }}>
              <AlertCircle size={13} />
              <span>Google location search is unavailable. You can still enter a location manually.</span>
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                role="option"
                onClick={() => selectSuggestion(suggestion)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  border: 0,
                  borderRadius: "6px",
                  padding: "9px 10px",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <MapPin size={13} style={{ color: "var(--blue)", flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "block", fontSize: "11px", color: "var(--text)" }}>{suggestion.mainText}</strong>
                  <span style={{ display: "block", fontSize: "9.5px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {suggestion.secondaryText || suggestion.description}
                  </span>
                </span>
                <Check size={12} style={{ color: "var(--success)", opacity: value === suggestion.description ? 1 : 0 }} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}