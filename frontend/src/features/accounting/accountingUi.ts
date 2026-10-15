export const primaryActionStyle = {
  minHeight: 36,
  padding: "0 14px",
  border: "1px solid #0F172A",
  borderRadius: 8,
  background: "#0F172A",
  color: "#FFF",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

export const secondaryActionStyle = {
  minHeight: 34,
  padding: "0 12px",
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  background: "#FFF",
  color: "#334155",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
} as const;

export const compactActionStyle = {
  minHeight: 30,
  padding: "0 9px",
  border: "1px solid #CBD5E1",
  borderRadius: 7,
  background: "#FFF",
  color: "#334155",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
} as const;

export const disabledActionStyle = { opacity: 0.5, cursor: "not-allowed" } as const;
