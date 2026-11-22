import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { FullScreenIcon, NetworkIcon, PictureInPictureIcon, PlayIcon, StopIcon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import type { MediaSession } from "@/media/media-session"

export function ViewerScreen({ session, onStop }: { session: MediaSession | null; onStop: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(80)

  useEffect(() => {
    const element = video.current
    if (!element || !session?.stream) return
    element.srcObject = session.stream
    void element.play().catch(() => {
      element.muted = true
      setMuted(true)
      void element.play().catch(() => undefined)
    })
  }, [session, session?.stream])

  useEffect(() => {
    if (!video.current) return
    video.current.muted = muted
    video.current.volume = volume / 100
  }, [muted, volume])

  if (!session || session.role !== "viewer") return null
  if (session.status === "ended") {
    return <div className="flex min-h-full items-center justify-center p-7"><Empty className="max-w-lg border border-border bg-card/40"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={StopIcon} /></EmptyMedia><EmptyTitle>Transmissão encerrada</EmptyTitle><EmptyDescription>O host encerrou a sessão. Você pode voltar ao início ou aguardar um novo convite.</EmptyDescription></EmptyHeader></Empty></div>
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 p-7">
      <section className="app-enter flex items-center justify-between">
        <div><div className="flex items-center gap-3"><h1 className="font-heading text-2xl font-medium tracking-[-0.04em]">Transmissão ao vivo</h1><Badge variant="secondary">{session.status === "reconnecting" ? "Recuperando rota" : "Conectado"}</Badge></div><p className="mt-1.5 text-sm text-muted-foreground">{session.parentId ? `Assistindo ${session.parentId === session.hostId ? "diretamente do host" : `via ${session.parentName}`}` : "Aguardando uma atribuição do host"}</p></div>
        <Button variant="outline" onClick={onStop}><HugeiconsIcon icon={StopIcon} data-icon="inline-start" />Sair da transmissão</Button>
      </section>
      {session.error && <Alert variant="destructive"><AlertTitle>Conexão bloqueada</AlertTitle><AlertDescription>{session.error}</AlertDescription></Alert>}
      <div ref={stage} className="app-enter-media relative overflow-hidden rounded-2xl border border-border bg-[#090a0b]">
        <div className="aspect-video max-h-[560px] w-full">
          {session.stream ? <video ref={video} autoPlay playsInline className="size-full object-contain" /> : <div className="flex size-full flex-col items-center justify-center gap-4"><Spinner className="size-6" /><p className="text-sm text-muted-foreground">Aguardando vídeo do pai atribuído</p></div>}
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
          <Button variant="ghost" size="icon-sm" aria-label={muted ? "Ativar som" : "Mutar"} onClick={() => setMuted((value) => !value)}><HugeiconsIcon icon={muted ? VolumeOffIcon : VolumeHighIcon} /></Button>
          <Slider aria-label="Volume" className="max-w-40" value={[volume]} onValueChange={(value) => setVolume(Array.isArray(value) ? value[0] : value)} />
          <span className="w-10 text-xs text-muted-foreground tabular-nums">{volume}%</span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Picture in picture" onClick={() => void video.current?.requestPictureInPicture().catch(() => undefined)}><HugeiconsIcon icon={PictureInPictureIcon} /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Tela cheia" onClick={() => void stage.current?.requestFullscreen().catch(() => undefined)}><HugeiconsIcon icon={FullScreenIcon} /></Button>
          </div>
        </div>
      </div>
      <Card className="border-border/60 ring-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><HugeiconsIcon icon={NetworkIcon} className="size-5" />Sua rota nesta sessão</CardTitle><CardDescription>{session.childIds.length ? `Você está retransmitindo para ${session.childIds.length} espectador. A track remota é encaminhada sem capturar seu áudio local.` : "Você é um leaf e não abre saídas de mídia para outros participantes."}</CardDescription></CardHeader>
        {session.childIds.length > 0 && <CardContent><Badge><HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />Relay autorizado pelo host</Badge></CardContent>}
      </Card>
    </div>
  )
}
