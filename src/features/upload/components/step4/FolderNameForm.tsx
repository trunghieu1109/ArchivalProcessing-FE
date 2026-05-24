import { useState } from "react"
import { CheckCircle2, Edit2, Check, ChevronDown, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import type { FolderNode } from "@/features/upload/types"

interface FolderNameFormProps {
  node: FolderNode
  onSave: (id: string, patch: Partial<FolderNode>) => void
}

export function FolderNameForm({ node, onSave }: FolderNameFormProps) {
  const [open, setOpen] = useState(false)
  const [hoSoName, setHoSoName] = useState(node.hoSoName ?? "")
  const [soHoSo, setSoHoSo] = useState(node.soHoSo ?? "")
  const [thoiHan, setThoiHan] = useState(node.thoiHanBaoQuan ?? "")
  const isFilled = !!(node.hoSoName && node.soHoSo && node.thoiHanBaoQuan)

  const handleSave = () => {
    if (!hoSoName.trim()) { toast.error("Vui lòng nhập tên hồ sơ."); return }
    if (!soHoSo.trim()) { toast.error("Vui lòng nhập số hồ sơ."); return }
    if (!thoiHan.trim()) { toast.error("Vui lòng nhập thời hạn bảo quản."); return }
    onSave(node.id, { hoSoName: hoSoName.trim(), soHoSo: soHoSo.trim(), thoiHanBaoQuan: thoiHan.trim() })
    setOpen(false)
    toast.success(`Đã lưu hồ sơ: ${hoSoName.trim()}`)
  }

  return (
    <div className={cn(
      "mt-1 overflow-hidden rounded-xl border transition-all duration-200",
      isFilled ? "border-[#0052FF]/20 bg-[#0052FF]/[0.02]" : "border-[#E2E8F0] bg-[#FAFAFA]",
    )}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <div className="flex items-center gap-2">
          {isFilled ? <CheckCircle2 className="size-3.5 text-[#0052FF]" /> : <Edit2 className="size-3.5 text-[#94A3B8]" />}
          <span className={cn("text-xs font-medium", isFilled ? "text-[#0052FF]" : "text-[#64748B]")}>
            {isFilled ? node.hoSoName : "Đặt tên hồ sơ…"}
          </span>
          {isFilled && (
            <span className="text-[10px] text-[#64748B]">· {node.soHoSo} · {node.thoiHanBaoQuan}</span>
          )}
        </div>
        {open ? <ChevronDown className="size-3.5 text-[#64748B]" /> : <ChevronRight className="size-3.5 text-[#64748B]" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 border-t border-[#E2E8F0] px-3 py-3">
              {[
                { label: "Tên hồ sơ", value: hoSoName, set: setHoSoName, placeholder: "VD: Hồ sơ bổ nhiệm 2021" },
                { label: "Số hồ sơ", value: soHoSo, set: setSoHoSo, placeholder: "VD: 01/HS-2021" },
                { label: "Thời hạn bảo quản", value: thoiHan, set: setThoiHan, placeholder: "VD: 10 năm / Vĩnh viễn" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="flex items-center gap-2">
                  <label className="w-32 shrink-0 text-[11px] font-medium text-[#64748B]">{label}</label>
                  <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                    className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#0052FF]/50 focus:ring-1 focus:ring-[#0052FF]/20" />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F1F5F9]">Hủy</button>
                <button onClick={handleSave} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(to right, #0052FF, #4D7CFF)" }}>
                  <Check className="size-3" /> Lưu
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
