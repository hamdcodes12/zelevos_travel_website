// Authoritative Attendance Duration & Remarks Helper
export interface AttendanceMetadata {
  state: "checked_in" | "on_break" | "checked_out";
  break_start_time?: string | null;
  total_break_seconds: number;
  total_break_minutes: number;
  total_working_seconds: number;
  total_working_minutes: number;
  break_history: Array<{ start: string; end: string; seconds?: number; minutes: number }>;
}

export function parseAttendanceRemarks(remarks: string | null): AttendanceMetadata {
  const defaultMeta: AttendanceMetadata = {
    state: "checked_out",
    break_start_time: null,
    total_break_seconds: 0,
    total_break_minutes: 0,
    total_working_seconds: 0,
    total_working_minutes: 0,
    break_history: [],
  };
  if (!remarks) return defaultMeta;

  if (remarks.startsWith("{")) {
    try {
      const parsed = JSON.parse(remarks);
      const totalSec = Number(parsed.total_working_seconds) || 0;
      const breakSec = Number(parsed.total_break_seconds) || 0;
      return {
        state: parsed.state || (parsed.remarks?.startsWith("on_break") ? "on_break" : parsed.remarks === "checked_in" ? "checked_in" : "checked_out"),
        break_start_time: parsed.break_start_time || null,
        total_break_seconds: breakSec,
        total_break_minutes: Number(parsed.total_break_minutes) || Math.floor(breakSec / 60),
        total_working_seconds: totalSec,
        total_working_minutes: Number(parsed.total_working_minutes) || Math.floor(totalSec / 60),
        break_history: Array.isArray(parsed.break_history) ? parsed.break_history : [],
      };
    } catch {}
  }

  if (remarks.startsWith("on_break")) {
    defaultMeta.state = "on_break";
    const parts = remarks.split(":");
    if (parts.length > 1) {
      defaultMeta.break_start_time = parts.slice(1).join(":");
    }
  } else if (remarks === "checked_in") {
    defaultMeta.state = "checked_in";
  } else if (remarks.startsWith("checked_out")) {
    defaultMeta.state = "checked_out";
    const breakMatch = remarks.match(/break (\d+)m/);
    if (breakMatch) {
      defaultMeta.total_break_minutes = parseInt(breakMatch[1], 10);
      defaultMeta.total_break_seconds = defaultMeta.total_break_minutes * 60;
    }
  }
  return defaultMeta;
}

export function formatAttendanceRemarks(meta: AttendanceMetadata): string {
  return JSON.stringify({
    state: meta.state,
    break_start_time: meta.break_start_time || null,
    total_break_seconds: meta.total_break_seconds || 0,
    total_break_minutes: meta.total_break_minutes || Math.floor((meta.total_break_seconds || 0) / 60),
    total_working_seconds: meta.total_working_seconds || 0,
    total_working_minutes: meta.total_working_minutes || Math.floor((meta.total_working_seconds || 0) / 60),
    break_history: meta.break_history || [],
  });
}

export function formatStopwatchSeconds(totalSec: number): string {
  if (totalSec <= 0) return "00:00:00";
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatWorkingDurationDisplay(totalSec: number): string {
  if (totalSec <= 0) return "00h 00m";
  if (totalSec < 60) return `00:00:${String(totalSec).padStart(2, "0")}`;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}
