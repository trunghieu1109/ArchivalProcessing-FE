import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  ArrowLeft,
  Download,
  FileSearch2,
  Loader2,
  Radar,
  RotateCcw,
  Server,
} from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import {
  AuditCapabilityMarquee,
  AuditSummary,
} from "@/features/backend-audit/components/AuditSummary"
import { ConnectionPanel } from "@/features/backend-audit/components/ConnectionPanel"
import { EndpointCatalog } from "@/features/backend-audit/components/EndpointCatalog"
import { FondsBrowser } from "@/features/backend-audit/components/FondsBrowser"
import { FondsDetailPanel } from "@/features/backend-audit/components/FondsDetailPanel"
import { JsonInspector } from "@/features/backend-audit/components/JsonInspector"
import {
  AUDIT_ENDPOINTS,
  auditEndpointPath,
  extractAuditSessions,
  normalizeAuditBaseUrl,
  normalizeAuditPath,
  runAuditRequest,
  type AuditConnectionConfig,
  type AuditEndpoint,
  type AuditRequestResult,
} from "@/features/backend-audit/backendAudit"
import { UserMenu } from "@/features/auth/components/UserMenu"

gsap.registerPlugin(useGSAP, ScrollTrigger)

const CONFIG_STORAGE_KEY = "archival-processing:backend-audit-config"

export function BackendAuditPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const controllersRef = useRef(new Map<string, AbortController>())
  const [config, setConfig] = useState<AuditConnectionConfig>(readStoredConfig)
  const [results, setResults] = useState<Record<string, AuditRequestResult>>({})
  const [history, setHistory] = useState<AuditRequestResult[]>([])
  const [sessionId, setSessionId] = useState("")
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    null
  )
  const [runningEndpointIds, setRunningEndpointIds] = useState<Set<string>>(
    () => new Set()
  )
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    window.sessionStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({
        baseUrl: config.baseUrl,
        authMode: config.authMode,
        apiKeyHeader: config.apiKeyHeader,
      })
    )
  }, [config.apiKeyHeader, config.authMode, config.baseUrl])

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort())
    },
    []
  )

  useGSAP(
    () => {
      gsap.from(".audit-hero-copy > *", {
        y: 32,
        opacity: 0,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
      })
      gsap.fromTo(
        ".audit-system-visual",
        { scale: 0.88, opacity: 0.25 },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
        }
      )
      gsap.utils.toArray<HTMLElement>(".audit-reveal").forEach((element) => {
        gsap.from(element, {
          y: 38,
          opacity: 0,
          duration: 0.65,
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 92%", once: true },
        })
      })
      gsap.utils
        .toArray<HTMLElement>(".audit-stack-card")
        .forEach((element, index) => {
          gsap.from(element, {
            y: 28 + index * 5,
            scale: 0.97,
            opacity: 0,
            duration: 0.55,
            ease: "power2.out",
            scrollTrigger: { trigger: element, start: "top 94%", once: true },
          })
        })
    },
    { scope: pageRef }
  )

  const performRequest = useCallback(
    async (
      endpoint: AuditEndpoint,
      path: string,
      requestConfig: AuditConnectionConfig = config
    ) => {
      controllersRef.current.get(endpoint.id)?.abort()
      const controller = new AbortController()
      controllersRef.current.set(endpoint.id, controller)
      setRunningEndpointIds((current) => new Set(current).add(endpoint.id))
      const result = await runAuditRequest(
        requestConfig,
        endpoint,
        path,
        controller.signal
      )
      setResults((current) => ({ ...current, [endpoint.id]: result }))
      setHistory((current) => [result, ...current].slice(0, 100))
      setSelectedEndpointId(endpoint.id)
      controllersRef.current.delete(endpoint.id)
      setRunningEndpointIds((current) => {
        const next = new Set(current)
        next.delete(endpoint.id)
        return next
      })
      return result
    },
    [config]
  )

  const runEndpoint = useCallback(
    async (endpoint: AuditEndpoint) => {
      try {
        const path = auditEndpointPath(endpoint, sessionId)
        await performRequest(endpoint, path)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Endpoint không hợp lệ."
        )
      }
    },
    [performRequest, sessionId]
  )

  const openSession = useCallback(
    async (
      nextSessionId: string,
      requestConfig: AuditConnectionConfig = config
    ) => {
      const normalizedSessionId = nextSessionId.trim()
      if (!normalizedSessionId) {
        toast.error("Hãy chọn hoặc nhập session ID.")
        return
      }
      setSessionId(normalizedSessionId)
      const detailEndpointIds = [
        "session-detail",
        "digitization",
        "cluster-build",
        "active-plan",
        "active-clusters",
        "dossiers",
      ]
      setResults((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([endpointId]) => !detailEndpointIds.includes(endpointId)
          )
        )
      )
      await Promise.all(
        detailEndpointIds.map((endpointId) => {
          const endpoint = endpointById(endpointId)
          return performRequest(
            endpoint,
            auditEndpointPath(endpoint, normalizedSessionId),
            requestConfig
          )
        })
      )
      setSelectedEndpointId("session-detail")
    },
    [config, performRequest]
  )

  const connect = async () => {
    let normalizedBaseUrl: string
    try {
      normalizedBaseUrl = normalizeAuditBaseUrl(config.baseUrl)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Base URL không hợp lệ."
      )
      return
    }
    const nextConfig = { ...config, baseUrl: normalizedBaseUrl }
    setConfig(nextConfig)
    setConnecting(true)
    const healthEndpoint = endpointById("health")
    const sessionsEndpoint = endpointById("sessions")
    const [health, sessionsResult] = await Promise.all([
      performRequest(
        healthEndpoint,
        auditEndpointPath(healthEndpoint, ""),
        nextConfig
      ),
      performRequest(
        sessionsEndpoint,
        auditEndpointPath(sessionsEndpoint, ""),
        nextConfig
      ),
    ])
    setConnecting(false)
    const sessions = extractAuditSessions(sessionsResult.data)
    if (!sessionId && sessions[0]) {
      await openSession(sessions[0].session_id, nextConfig)
    }
    if (health.ok || sessionsResult.ok) {
      toast.success(
        sessions.length
          ? `Đã kết nối và tìm thấy ${sessions.length} phông tài liệu.`
          : "Đã kết nối backend. Chưa tìm thấy phông tài liệu."
      )
    } else {
      toast.error(
        health.error || sessionsResult.error || "Không thể kết nối backend."
      )
    }
  }

  const runAll = async () => {
    if (!config.baseUrl.trim()) {
      toast.error("Hãy nhập và kết nối backend trước.")
      return
    }
    const runnable = AUDIT_ENDPOINTS.filter(
      (endpoint) => !endpoint.requiresSession || sessionId.trim()
    )
    await Promise.all(
      runnable.map((endpoint) =>
        performRequest(endpoint, auditEndpointPath(endpoint, sessionId))
      )
    )
    toast.success(`Đã hoàn tất ${runnable.length} kiểm tra đọc dữ liệu.`)
  }

  const cancelAll = () => {
    controllersRef.current.forEach((controller) => controller.abort())
    controllersRef.current.clear()
  }

  const runCustom = async (rawPath: string) => {
    try {
      const path = normalizeAuditPath(
        rawPath.replaceAll("{id}", encodeURIComponent(sessionId.trim()))
      )
      const endpoint: AuditEndpoint = {
        id: "custom",
        title: "GET tùy chỉnh",
        description: "Endpoint do người audit nhập.",
        category: "evidence",
        path,
      }
      await performRequest(endpoint, path)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Endpoint không hợp lệ."
      )
    }
  }

  const reset = () => {
    cancelAll()
    setResults({})
    setHistory([])
    setSelectedEndpointId(null)
    toast.info("Đã xóa kết quả audit trong phiên hiện tại.")
  }

  const exportReport = () => {
    if (history.length === 0) {
      toast.error("Chưa có dữ liệu để xuất báo cáo.")
      return
    }
    const report = {
      schema_version: "backend-audit-report.v1",
      generated_at: new Date().toISOString(),
      target: config.baseUrl,
      session_id: sessionId || null,
      summary: {
        requests: history.length,
        successful: history.filter((item) => item.ok).length,
        failed: history.filter((item) => !item.ok).length,
      },
      results: history,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `backend-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Đã xuất báo cáo audit, không bao gồm credential.")
  }

  const sessions = useMemo(
    () => extractAuditSessions(results.sessions?.data),
    [results.sessions]
  )
  const selectedResult = selectedEndpointId
    ? (results[selectedEndpointId] ?? null)
    : null
  const connectionProbe = results.health ?? results.sessions ?? null
  const fondsDetailsLoading = [
    "session-detail",
    "digitization",
    "cluster-build",
    "active-plan",
    "active-clusters",
    "dossiers",
  ].some((endpointId) => runningEndpointIds.has(endpointId))

  return (
    <div
      ref={pageRef}
      className="backend-audit-page min-h-svh w-full max-w-full overflow-x-hidden bg-[#edf2f3] text-slate-950"
    >
      <header className="relative z-20 border-b border-white/10 bg-[#07111f] text-white">
        <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/sessions"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-200"
              aria-label="Quay về danh sách session"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
                <Radar className="size-5" />
              </div>
              <div className="hidden min-w-0 min-[480px]:block">
                <p className="truncate text-sm font-bold">MBFS Backend Audit</p>
                <p className="truncate text-[11px] text-slate-400">
                  Read-only infrastructure console
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="hidden size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 sm:flex"
              title="Xóa kết quả"
              aria-label="Xóa kết quả"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="hidden h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/20 md:flex"
            >
              <Download className="size-4" /> Xuất báo cáo
            </button>
            <div className="hidden sm:block">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-full overflow-x-hidden">
        <section className="relative overflow-hidden bg-[#07111f] pb-28 text-white sm:pb-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.12),transparent_32%)]" />
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px] opacity-[0.035]" />
          <div className="relative mx-auto grid max-w-[1560px] grid-flow-dense grid-cols-1 gap-12 px-4 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:items-center lg:px-8 lg:pt-24">
            <div className="audit-hero-copy lg:col-span-7">
              <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-cyan-300 uppercase">
                <Server className="size-4" /> Infrastructure intelligence
              </div>
              <h1 className="mt-6 max-w-5xl text-[clamp(2.75rem,5vw,5.4rem)] leading-[0.98] font-semibold tracking-[-0.055em] text-balance">
                Audit xuyên suốt hạ tầng backend.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Kết nối một phiên bản của hệ thống, chọn phông và kiểm tra OCR,
                lập hồ sơ, hồ sơ cùng toàn bộ dấu vết vận hành trong một luồng
                đọc an toàn.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400" /> Chỉ
                  đọc GET
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan-300" /> Không lưu
                  token
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-400" /> Xuất JSON
                  bằng chứng
                </span>
              </div>
            </div>
            <div className="lg:col-span-5">
              <ConnectionPanel
                config={config}
                onChange={setConfig}
                onConnect={() => void connect()}
                connecting={connecting}
                probe={connectionProbe}
              />
            </div>
          </div>
          <div className="relative mt-16">
            <AuditCapabilityMarquee />
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-16 max-w-[1560px] px-4 sm:px-6 lg:px-8">
          <AuditSummary
            results={results}
            history={history}
            onSelectResult={setSelectedEndpointId}
          />
        </div>

        <section className="mx-auto max-w-[1560px] space-y-20 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <FondsBrowser
            sessions={sessions}
            sessionId={sessionId}
            onSessionIdChange={setSessionId}
            onOpenSession={(nextSessionId) => void openSession(nextSessionId)}
            opening={fondsDetailsLoading}
          />

          <FondsDetailPanel
            sessionId={sessionId}
            results={results}
            loading={fondsDetailsLoading}
            onRefresh={() => void openSession(sessionId)}
            onOpenRaw={setSelectedEndpointId}
          />

          <div className="grid items-start gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <EndpointCatalog
                sessionId={sessionId}
                results={results}
                selectedEndpointId={selectedEndpointId}
                runningEndpointIds={runningEndpointIds}
                onRun={(endpoint) => void runEndpoint(endpoint)}
                onSelect={setSelectedEndpointId}
                onRunAll={() => void runAll()}
                onCancelAll={cancelAll}
                onRunCustom={(path) => void runCustom(path)}
              />
            </div>
            <div className="audit-reveal xl:sticky xl:top-5 xl:col-span-5">
              <JsonInspector result={selectedResult} />
            </div>
          </div>
        </section>

        <section className="bg-[#07111f] px-4 py-20 text-white sm:px-6 sm:py-24">
          <div className="mx-auto flex max-w-[1560px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-cyan-300 uppercase">
                <FileSearch2 className="size-4" /> Audit evidence
              </div>
              <h2 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Đóng gói toàn bộ phản hồi thành một hồ sơ đối chiếu.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
                Báo cáo chứa URL đích, HTTP status, latency, response headers và
                payload; credential luôn bị loại khỏi file xuất.
              </p>
            </div>
            <button
              type="button"
              onClick={exportReport}
              disabled={history.length === 0}
              className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {runningEndpointIds.size > 0 ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Xuất báo cáo audit
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function endpointById(id: string): AuditEndpoint {
  const endpoint = AUDIT_ENDPOINTS.find((item) => item.id === id)
  if (!endpoint) throw new Error(`Thiếu cấu hình endpoint ${id}.`)
  return endpoint
}

function readStoredConfig(): AuditConnectionConfig {
  const defaults: AuditConnectionConfig = {
    baseUrl: window.location.origin,
    authMode: "bearer",
    credential: "",
    apiKeyHeader: "X-API-Key",
  }
  try {
    const raw = window.sessionStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return defaults
    const stored = JSON.parse(raw) as Partial<AuditConnectionConfig>
    return {
      ...defaults,
      baseUrl:
        typeof stored.baseUrl === "string" ? stored.baseUrl : defaults.baseUrl,
      authMode:
        stored.authMode === "none" ||
        stored.authMode === "bearer" ||
        stored.authMode === "api-key"
          ? stored.authMode
          : defaults.authMode,
      apiKeyHeader:
        typeof stored.apiKeyHeader === "string"
          ? stored.apiKeyHeader
          : defaults.apiKeyHeader,
    }
  } catch {
    return defaults
  }
}
