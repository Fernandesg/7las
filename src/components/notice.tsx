import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { SessionNotice } from "@/types"

export function Notice({ notice }: { notice: SessionNotice }) {
  if (!notice) return null
  const icon = notice.tone === "error" ? Alert02Icon : notice.tone === "success" ? CheckmarkCircle02Icon : InformationCircleIcon
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 w-[min(380px,calc(100vw-40px))]">
      <Alert variant={notice.tone === "error" ? "destructive" : "default"} className="pointer-events-auto border-border bg-popover shadow-2xl" role="status">
        <HugeiconsIcon icon={icon} />
        <AlertTitle>{notice.title}</AlertTitle>
        {notice.description && <AlertDescription>{notice.description}</AlertDescription>}
      </Alert>
    </div>
  )
}
