export const metadataButtonClass =
  "h-10 gap-2 rounded-xl border-[#CBD5E1] bg-white px-4 font-semibold text-[#475569] shadow-sm hover:border-[#0052FF]/40 hover:bg-[#F8FAFC] hover:text-[#0052FF]"

export const metadataPrimaryButtonClass =
  "h-10 gap-2 rounded-xl bg-[#0052FF] px-4 font-semibold text-white shadow-[0_8px_24px_rgba(0,82,255,0.16)] hover:bg-[#0047D6]"

export const metadataInputClass =
  "mt-1 min-h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/15 disabled:bg-slate-100"

export function metadataSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
}
