import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Home } from "lucide-react"
import { toast } from "sonner"

import {
  getSession,
  patchSessionMetadata,
} from "@/features/upload/api/sessionApi"
import {
  SessionMetadataBar,
  type SessionMetadataValues,
} from "@/features/upload/components/SessionMetadataBar"

interface SessionWorkflowContextProps {
  sessionId: string
  readOnly?: boolean
  onBack: () => void
  onNavigateSessions: () => void
}

export function SessionWorkflowContext({
  sessionId,
  readOnly = false,
  onBack,
  onNavigateSessions,
}: SessionWorkflowContextProps) {
  const [metadata, setMetadata] = useState<SessionMetadataValues>({})

  useEffect(() => {
    let cancelled = false
    void getSession(sessionId)
      .then((session) => {
        if (!cancelled) setMetadata(session)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Không tải được thông tin kho/phông."
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const saveMetadata = useCallback(
    async (values: SessionMetadataValues) => {
      const updated = await patchSessionMetadata(sessionId, values)
      setMetadata(updated)
    },
    [sessionId]
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onNavigateSessions}
          className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
        >
          <Home className="size-4" /> Danh sách session
        </motion.button>
        {!readOnly && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </motion.button>
        )}
      </div>

      <SessionMetadataBar
        sessionId={sessionId}
        metadata={metadata}
        onSave={saveMetadata}
        readOnly={readOnly}
      />
    </div>
  )
}
