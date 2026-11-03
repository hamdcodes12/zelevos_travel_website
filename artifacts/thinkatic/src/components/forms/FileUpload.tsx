/**
 * FileUpload — drag-and-drop file upload with preview
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Image, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldWrapper } from "./FormField";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image size={16} />;
  if (type === "application/pdf" || type.includes("document")) return <FileText size={16} />;
  return <File size={16} />;
}

interface FileUploadProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  value?: File[];
  onChange?: (files: File[]) => void;
  wrapperClassName?: string;
}

export function FileUpload({
  label,
  error,
  hint,
  required,
  accept,
  multiple = false,
  maxSizeMB = 10,
  value = [],
  onChange,
  wrapperClassName,
}: FileUploadProps) {
  const [dragging, setDragging] = React.useState(false);
  const [sizeError, setSizeError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setSizeError("");
    const arr = Array.from(incoming);
    const tooBig = arr.find(f => f.size > maxSizeMB * 1024 * 1024);
    if (tooBig) {
      setSizeError(`"${tooBig.name}" exceeds ${maxSizeMB} MB limit`);
      return;
    }
    const next = multiple ? [...value, ...arr] : [arr[0]];
    onChange?.(next);
  };

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const displayError = error || sizeError;
  const acceptLabel = accept
    ? accept.replace(/application\//g, "").replace(/image\//g, "").toUpperCase()
    : "Any file";

  return (
    <FieldWrapper label={label} error={displayError} hint={hint} required={required} className={wrapperClassName}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 group",
          dragging
            ? "border-[#214ECF]/70 bg-[#214ECF]/08"
            : displayError
              ? "border-red-500/40 hover:border-red-500/60"
              : "border-border hover:border-white/25 hover:bg-white/[0.02]",
        )}
        style={dragging ? { background: "rgba(71,163,255,0.06)" } : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={e => addFiles(e.target.files)}
          onClick={e => e.stopPropagation()}
        />

        <motion.div
          animate={{ scale: dragging ? 1.1 : 1, y: dragging ? -2 : 0 }}
          transition={{ duration: 0.2, ease }}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            dragging ? "bg-[#214ECF]/20" : "bg-white/[0.05] group-hover:bg-white/[0.08]",
          )}
        >
          <Upload size={18} className={cn("transition-colors", dragging ? "text-[#214ECF]" : "text-muted-foreground group-hover:text-muted-foreground")} />
        </motion.div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors">
            <span className="text-[#214ECF]">Click to upload</span> or drag & drop
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {acceptLabel} · Max {maxSizeMB} MB {multiple && "· Multiple files OK"}
          </p>
        </div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            {value.map((file, i) => (
              <motion.div
                key={`${file.name}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, ease }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                style={{ background: "rgba(71,163,255,0.05)", borderColor: "rgba(33,78,207,0.12)" }}
              >
                <div className="text-[#214ECF]/70">{fileIcon(file.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); remove(i); }}
                  className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                >
                  <X size={13} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </FieldWrapper>
  );
}
