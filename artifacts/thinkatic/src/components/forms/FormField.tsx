/**
 * Thinkatic Design System — Custom Form Field Primitives
 *
 * Dark-themed, professional form components that match the site's
 * aesthetic. Built on RHF + Zod with full accessibility.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Base input wrapper ───────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FieldWrapper({ label, error, hint, required, children, className }: FieldWrapperProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#0B1220]/80 font-bold select-none">
          {label}
          {required && <span className="text-[#214ECF] ml-1">*</span>}
        </label>
      )}
      {children}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease }}
            className="flex items-center gap-1.5 text-[11px] text-red-500 font-medium"
          >
            <AlertCircle size={11} className="shrink-0" />
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-slate-500"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputBase = [
  "w-full bg-white border border-slate-200 rounded-xl px-4 py-3",
  "text-sm text-[#0B1220] font-medium placeholder:text-slate-400",
  "transition-all duration-200",
  "focus:outline-none focus:border-[#214ECF] focus:bg-white focus:ring-[3px] focus:ring-[#214ECF]/10 focus:shadow-[0_0_0_3px_rgba(33,78,207,0.10)]",
  "hover:border-blue-300 hover:bg-white",
  "disabled:opacity-40 disabled:cursor-not-allowed",
].join(" ");

// ─── FormInput ────────────────────────────────────────────────────────────────

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, icon, wrapperClassName, className, type, ...props }, ref) => {
    const [showPw, setShowPw] = React.useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPw ? "text" : "password") : type;

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClassName}>
        <div className="relative group">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#214ECF] group-focus-within:text-[#214ECF] transition-colors pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              inputBase,
              icon && "pl-10",
              isPassword && "pr-12",
              error && "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {/* Animated focus glow */}
          <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
            style={{ boxShadow: "0 0 0 1px rgba(33,78,207,0.12), 0 0 16px rgba(71,163,255,0.06)" }} />
        </div>
      </FieldWrapper>
    );
  }
);
FormInput.displayName = "FormInput";

// ─── FormTextarea ─────────────────────────────────────────────────────────────

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, hint, wrapperClassName, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClassName}>
      <div className="relative group">
        <textarea
          ref={ref}
          className={cn(
            inputBase,
            "min-h-[120px] resize-y leading-relaxed",
            error && "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10",
            className
          )}
          {...props}
        />
        <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: "0 0 0 1px rgba(33,78,207,0.12), 0 0 16px rgba(71,163,255,0.06)" }} />
      </div>
    </FieldWrapper>
  )
);
FormTextarea.displayName = "FormTextarea";

// ─── FormSelect (native) ──────────────────────────────────────────────────────

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  placeholder?: string;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, hint, wrapperClassName, className, placeholder, children, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClassName}>
      <div className="relative group">
        <select
          ref={ref}
          className={cn(
            inputBase,
            "appearance-none cursor-pointer pr-10",
            "text-sm font-medium text-[#0B1220]",
            // If empty / first option selected, show muted
            "[&:invalid]:text-slate-400",
            error && "border-red-500/50",
            className
          )}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {children}
        </select>
        {/* Custom arrow */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 7L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: "0 0 0 1px rgba(33,78,207,0.12), 0 0 16px rgba(71,163,255,0.06)" }} />
      </div>
    </FieldWrapper>
  )
);
FormSelect.displayName = "FormSelect";

// ─── FormCheckbox ─────────────────────────────────────────────────────────────

interface FormCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export function FormCheckbox({ label, error, wrapperClassName, className, ...props }: FormCheckboxProps) {
  return (
    <div className={cn("flex flex-col gap-1", wrapperClassName)}>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div className={cn(
            "w-4.5 h-4.5 w-[18px] h-[18px] rounded-[5px] border border-[#DCE5FF] bg-white",
            "peer-checked:bg-[#214ECF] peer-checked:border-[#214ECF]",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[#214ECF]/30",
            "transition-all duration-150 group-hover:border-[#214ECF]/40",
            error && "border-red-500/60",
          )}>
            <AnimatePresence>
              {props.checked && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  viewBox="0 0 10 8" fill="none"
                  className="absolute inset-0 w-full h-full p-[3px]"
                >
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              )}
            </AnimatePresence>
          </div>
        </div>
        <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-muted-foreground transition-colors">
          {label}
        </span>
      </label>
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-400 ml-7">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── SuccessState ─────────────────────────────────────────────────────────────

interface SuccessStateProps {
  title: string;
  message: string;
  onReset?: () => void;
  resetLabel?: string;
}

export function SuccessState({ title, message, onReset, resetLabel = "Send another" }: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="flex flex-col items-center text-center py-12 px-6 gap-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 200 }}
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(33,78,207,0.1)", border: "1px solid rgba(71,163,255,0.25)" }}
      >
        <CheckCircle2 size={32} className="text-[#214ECF]" />
      </motion.div>
      <div>
        <h3 className="font-display font-bold text-foreground text-2xl mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">{message}</p>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-2 text-sm text-muted-foreground hover:text-muted-foreground transition-colors underline underline-offset-4"
        >
          {resetLabel}
        </button>
      )}
    </motion.div>
  );
}

// ─── ErrorBanner ─────────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border"
      style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
    >
      <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-sm text-red-400">{message}</p>
    </motion.div>
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

export function StepIndicator({ step, total, labels }: { step: number; total: number; labels?: string[] }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1.5">
            <motion.div
              animate={{
                background: i < step
                  ? "linear-gradient(135deg,#214ECF,#214ECF)"
                  : i === step
                    ? "rgba(33,78,207,0.12)"
                    : "rgba(33,78,207,0.04)",
                borderColor: i <= step ? "#214ECF" : "rgba(33,78,207,0.12)",
                scale: i === step ? 1.1 : 1,
              }}
              transition={{ duration: 0.3, ease }}
              className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono font-bold"
              style={{ color: i < step ? "#fff" : i === step ? "#214ECF" : "rgba(255,255,255,0.3)" }}
            >
              {i < step ? (
                <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : i + 1}
            </motion.div>
            {labels?.[i] && (
              <span className={cn("text-[10px] font-mono uppercase tracking-wider hidden sm:block",
                i === step ? "text-[#214ECF]" : i < step ? "text-muted-foreground" : "text-foreground/20")}>
                {labels[i]}
              </span>
            )}
          </div>
          {i < total - 1 && (
            <motion.div
              animate={{ background: i < step ? "linear-gradient(90deg,#214ECF,#214ECF)" : "rgba(33,78,207,0.06)" }}
              transition={{ duration: 0.4 }}
              className="flex-1 h-px mx-2"
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
