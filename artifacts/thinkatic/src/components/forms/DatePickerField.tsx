/**
 * DatePickerField — custom dark-themed date picker popover
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldWrapper } from "./FormField";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface DatePickerFieldProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  wrapperClassName?: string;
  disablePast?: boolean;
}

export function DatePickerField({
  value,
  onChange,
  label,
  error,
  required,
  placeholder = "Select a date",
  minDate,
  maxDate,
  wrapperClassName,
  disablePast = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(value?.getMonth() ?? today.getMonth());
  const ref = React.useRef<HTMLDivElement>(null);

  const effectiveMin = disablePast ? today : minDate;

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (effectiveMin && d < new Date(effectiveMin.getFullYear(), effectiveMin.getMonth(), effectiveMin.getDate())) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    return value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;
  };

  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const formatted = value
    ? value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <FieldWrapper label={label} error={error} required={required} className={wrapperClassName}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 text-left",
            "bg-white/[0.04] hover:bg-white/[0.06]",
            open
              ? "border-[#214ECF]/60 ring-1 ring-[#214ECF]/20"
              : error
                ? "border-red-500/50"
                : "border-border hover:border-[#DCE5FF]",
          )}
        >
          <CalendarDays size={15} className={cn("shrink-0", value ? "text-[#214ECF]" : "text-muted-foreground")} />
          <span className={cn("flex-1", value ? "text-foreground" : "text-muted-foreground")}>
            {formatted ?? placeholder}
          </span>
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange?.(null); }}
              className="text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease }}
              className="absolute z-50 top-full mt-2 rounded-2xl border p-4 w-72"
              style={{
                background: "rgba(10,10,15,0.97)",
                backdropFilter: "blur(24px)",
                borderColor: "rgba(33,78,207,0.08)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={prevMonth} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                  <ChevronLeft size={14} className="text-muted-foreground" />
                </button>
                <span className="text-sm font-semibold text-foreground">
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <button type="button" onClick={nextMonth} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const disabled = isDisabled(day);
                  const selected = isSelected(day);
                  const todayMark = isToday(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange?.(new Date(viewYear, viewMonth, day));
                        setOpen(false);
                      }}
                      className={cn(
                        "aspect-square rounded-lg text-xs font-medium transition-all duration-150",
                        selected
                          ? "text-foreground"
                          : todayMark
                            ? "text-[#214ECF] border border-[#214ECF]/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                        disabled && "opacity-25 cursor-not-allowed",
                      )}
                      style={selected ? {
                        background: "linear-gradient(135deg,#214ECF,#214ECF)",
                      } : undefined}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Today shortcut */}
              {!disablePast && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.(today);
                      setViewYear(today.getFullYear());
                      setViewMonth(today.getMonth());
                      setOpen(false);
                    }}
                    className="w-full text-center text-xs text-[#214ECF]/70 hover:text-[#214ECF] transition-colors"
                  >
                    Today
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FieldWrapper>
  );
}
