/**
 * CountrySelector — searchable country dropdown with flag emojis
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldWrapper } from "./FormField";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dialCode: "+31" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", dialCode: "+46" },
  { code: "NO", name: "Norway", flag: "🇳🇴", dialCode: "+47" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", dialCode: "+45" },
  { code: "FI", name: "Finland", flag: "🇫🇮", dialCode: "+358" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", dialCode: "+41" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "+82" },
  { code: "AE", name: "UAE", flag: "🇦🇪", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", dialCode: "+974" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "+55" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", dialCode: "+52" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dialCode: "+54" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", dialCode: "+64" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", dialCode: "+353" },
  { code: "PL", name: "Poland", flag: "🇵🇱", dialCode: "+48" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "+34" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "+39" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dialCode: "+351" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", dialCode: "+852" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", dialCode: "+886" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", dialCode: "+63" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", dialCode: "+60" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", dialCode: "+62" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", dialCode: "+66" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", dialCode: "+880" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", dialCode: "+92" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", dialCode: "+20" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "+233" },
  { code: "IL", name: "Israel", flag: "🇮🇱", dialCode: "+972" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", dialCode: "+90" },
  { code: "RU", name: "Russia", flag: "🇷🇺", dialCode: "+7" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", dialCode: "+380" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dialCode: "+56" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dialCode: "+57" },
  { code: "AT", name: "Austria", flag: "🇦🇹", dialCode: "+43" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", dialCode: "+32" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", dialCode: "+420" },
];

interface CountrySelectorProps {
  value?: string;
  onChange?: (code: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
}

export function CountrySelector({
  value,
  onChange,
  label,
  error,
  required,
  placeholder = "Select country",
  wrapperClassName,
}: CountrySelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = COUNTRIES.find(c => c.code === value);

  const filtered = React.useMemo(() =>
    COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search)
    ),
    [search]
  );

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search on open
  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <FieldWrapper label={label} error={error} required={required} className={wrapperClassName}>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label || "Select country"}
          onClick={() => setOpen(v => !v)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3.5 h-[52px] sm:h-[54px] rounded-xl border text-sm transition-all duration-200 bg-white hover:border-blue-300 text-[#0B1220] cursor-pointer shadow-2xs",
            open
              ? "border-[#214ECF] ring-[3px] ring-[#214ECF]/10 shadow-[0_0_0_3px_rgba(33,78,207,0.10)] bg-white"
              : error
                ? "border-red-500/50"
                : "border-slate-200 hover:border-blue-300",
          )}
        >
          <Globe size={16} className="text-[#214ECF] shrink-0" />
          {selected ? (
            <>
              <span className="text-lg leading-none">{selected.flag}</span>
              <span className="text-[#0B1220] font-semibold flex-1 text-left truncate">{selected.name}</span>
              <span className="text-[#0B1220]/60 text-xs font-mono">{selected.dialCode}</span>
            </>
          ) : (
            <span className="text-slate-400 flex-1 text-left font-normal">{placeholder}</span>
          )}
          <ChevronDown
            size={14}
            className={cn("text-slate-400 transition-transform duration-200 shrink-0", open && "rotate-180 text-[#214ECF]")}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease }}
              className="absolute z-50 top-full mt-2 w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_20px_45px_-10px_rgba(15,23,42,0.15)]"
            >
              {/* Search */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
                  <Search size={13} className="text-slate-500 shrink-0" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search countries..."
                    className="bg-transparent text-sm text-[#0B1220] placeholder:text-slate-400 flex-1 outline-none font-medium"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-slate-500 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-56 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500">No countries found</div>
                ) : (
                  filtered.map(country => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        onChange?.(country.code);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors text-left cursor-pointer",
                        country.code === value
                          ? "bg-blue-50 text-[#214ECF] font-semibold"
                          : "hover:bg-slate-50 text-[#0B1220] font-normal",
                      )}
                    >
                      <span className="text-lg leading-none">{country.flag}</span>
                      <span className="flex-1">{country.name}</span>
                      <span className="text-[#0B1220]/60 text-xs font-mono">{country.dialCode}</span>
                      {country.code === value && (
                        <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3 shrink-0">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#214ECF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FieldWrapper>
  );
}
