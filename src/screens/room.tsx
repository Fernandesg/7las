import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerScreenShareIcon, Copy01Icon, RefreshIcon, ScreenShareIcon, StopIcon, Tick02Icon, Upload01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { TreeVisual } from "@/components/tree-visual"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { MediaSession } from "@/media/media-session"
import type { AppSettings, QualityMode } from "@/types"

export function RoomScreen({ session, settings, onStart, onStop, onMode }: {
  session: MediaSession | null
  settings: AppSettings
  onStart: () => void
  onStop: () => void
  onMode: (mode: QualityMode) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState("")
  useEffect(() => {
    if (video.current && session?.stream) video.current.srcObject = session.stream
  }, [session, session?.stream])

  if (!session || session.role !== "host") {
    return (
      <div className="flex min-h-full items-center justify-center p-7">
        <Empty className="max-w-lg border border-border bg-card/40">
          <EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={ComputerScreenShareIcon} /></EmptyMedia><EmptyTitle>Nenhuma transmissão hospedada</EmptyTitle><EmptyDescription>Inicie uma captura para abrir uma sessão nova e convidar seus amigos.</EmptyDescription></EmptyHeader>
          <EmptyContent><Button onClick={onStart}><HugeiconsIcon icon={ScreenShareIcon} data-icon="inline-start" />Compartilhar tela</Button></EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 p-7 pb-10">
      <section className="app-enter flex items-center justify-between gap-4">
        <div><div className="flex items-center gap-2"><h1 className="font-heading text-2xl font-medium tracking-[-0.04em]">{settings.roomName}</h1><Badge><span className="size-1.5 rounded-full bg-primary-foreground" />Ao vivo</Badge></div><p className="mt-1.5 text-sm text-muted-foreground">Sessão efêmera · {session.viewers.length} de 4 espectadores</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void session.changeSource().catch((reason) => setActionError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Troca de fonte cancelada." : String(reason)))}><HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />Trocar fonte</Button><Button variant="destructive" onClick={onStop}><HugeiconsIcon icon={StopIcon} data-icon="inline-start" />Parar transmissão</Button></div>
      </section>
      {(session.error || actionError) && <Alert variant="destructive"><AlertTitle>Problema na conexão</AlertTitle><AlertDescription>{actionError || session.error}</AlertDescription></Alert>}
      <Card className="app-enter-media gap-0 overflow-hidden border-border/60 py-0 ring-0">
        <div className="relative aspect-video max-h-[390px] w-full bg-[#0b0c0d]">
          <video ref={video} autoPlay muted playsInline className="size-full object-contain" />
          <div className="absolute top-4 left-4"><Badge className="live-ring"><span className="size-1.5 rounded-full bg-primary-foreground" />Sua captura</Badge></div>
        </div>
        <div className="grid grid-cols-3 border-t border-border bg-card">
          <Metric icon={UserGroupIcon} label="Espectadores" value={String(session.viewers.length)} />
          <Metric icon={Upload01Icon} label="Saídas no host" value={`${session.directOutputs} ativas`} />
          <Metric icon={Upload01Icon} label="Upload medido" value={session.uploadBitrate === null ? "Aguardando métricas" : `${(session.uploadBitrate / 1_000_000).toFixed(1)} Mbps`} />
        </div>
      </Card>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] gap-5">
        <Card className="border-border/60 ring-0">
          <CardHeader><CardTitle>Árvore de distribuição</CardTitle><CardDescription>O host mantém duas saídas no cenário padrão; relays entram após consentimento e métricas saudáveis.</CardDescription></CardHeader>
          <CardContent><TreeVisual settings={settings} viewers={session.viewers} live={session.status === "live"} /></CardContent>
        </Card>
        <div className="flex flex-col gap-5">
          <Card className="border-border/60 ring-0">
            <CardHeader><CardTitle>Convite da sessão</CardTitle><CardDescription>Somente quem receber este segredo poderá localizar a sala.</CardDescription></CardHeader>
            <CardContent><Field><FieldLabel htmlFor="live-invite">Código efêmero</FieldLabel><div className="flex gap-2"><Input id="live-invite" readOnly value={session.inviteCode} className="min-w-0 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} /><Button size="icon" aria-label="Copiar convite" onClick={() => void navigator.clipboard.writeText(session.inviteCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })}><HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} /></Button></div><FieldDescription>Uma sessão nova gera outro segredo e outro host ID.</FieldDescription></Field></CardContent>
          </Card>
          <Card className="border-border/60 ring-0">
            <CardHeader><CardTitle>Qualidade da sessão</CardTitle><CardDescription>Os limites valem para cada saída.</CardDescription></CardHeader>
            <CardContent><ToggleGroup className="w-full" variant="outline" value={[session.mode]} onValueChange={(value) => value[0] && onMode(value[0] as QualityMode)}><ToggleGroupItem className="flex-1" value="sharp">Text · 30 fps</ToggleGroupItem><ToggleGroupItem className="flex-1" value="smooth">Motion · 60 fps</ToggleGroupItem></ToggleGroup></CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: typeof UserGroupIcon; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-r border-border px-5 py-4 last:border-r-0"><HugeiconsIcon icon={icon} className="size-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p></div></div>
}
