import { motion } from "framer-motion"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { cn } from "@/shared/lib/utils"
import type { AppStep } from "@/features/upload/types"
import { easeOut } from "./UploadPage.planUtils"

export function UploadPageHeader(props: Record<string, any>) {
  const { currentStep, STEP_LABELS, goTo, isWorkerUser, navigate } = props

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F0F4FF] to-[#E8EEFF] px-3 py-4 shadow-sm sm:px-4 sm:py-5">
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,82,255,0.08) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-[1560px]">
        <div className="grid items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6">
          {/* Left: badge + title + description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <button
              type="button"
              onClick={() => navigate("/sessions")}
              className="block rounded-xl focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="Quay lại danh sách session"
              title="Quay lại danh sách session"
            >
              <img
                src="/assets/mbfs.png"
                alt="MBFS Logo"
                className="h-14 w-auto object-contain sm:h-16 lg:h-20"
              />
            </button>
          </motion.div>

          <div className="rounded-2xl border border-[#CBD5E1]/70 bg-white/70 px-3 py-2 shadow-sm md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#64748B] uppercase">
                  Bước {currentStep}/6
                </p>
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {STEP_LABELS[currentStep - 1]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {STEP_LABELS.map((_: string, index: number) => {
                  const stepNumber = index + 1
                  return (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        stepNumber <= currentStep
                          ? "w-6 bg-[#0052FF]"
                          : "w-3 bg-[#CBD5E1]"
                      )}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Center: step indicators */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
            className="hidden min-w-0 justify-center overflow-x-auto md:flex"
          >
            <div className="flex min-w-max items-center">
              {STEP_LABELS.map((label: string, i: number) => {
                const s = (i + 1) as AppStep
                const isActive = currentStep === s
                const isDone = currentStep > s
                const canNav = !isWorkerUser && isDone
                return (
                  <div key={i} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={() => canNav && goTo(s)}
                        disabled={isWorkerUser && s !== 3}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                          isDone
                            ? "text-white hover:scale-105"
                            : isActive
                              ? "text-white"
                              : "border-2 border-[#CBD5E1] bg-white text-[#94A3B8]",
                          canNav ? "cursor-pointer" : "cursor-default"
                        )}
                        style={
                          isDone
                            ? {
                                background:
                                  "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                              }
                            : isActive
                              ? {
                                  background:
                                    "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                  boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                                }
                              : {}
                        }
                      >
                        {isDone ? "✓" : s}
                      </button>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          isActive
                            ? "font-semibold text-[#0052FF]"
                            : isDone
                              ? "text-[#64748B]"
                              : "text-[#94A3B8]"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className="mx-2 mb-5 h-px w-5 bg-[#CBD5E1] lg:w-8" />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Right: auth */}
          <UserMenu className="hidden justify-self-end md:flex" />
        </div>
        <UserMenu className="mt-3 ml-auto w-fit md:hidden" />
      </div>
    </div>
  )
}
