import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerScreenShareIcon, Delete01Icon, Link01Icon, ScreenShareIcon, SecurityCheckIcon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { FriendsDialog } from "@/components/friends-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { AppSettings, Friend } from "@/types"

export function HomeScreen({ settings, friends, starting, onStart, onAddFriend, onRemoveFriend, onJoin }: {
  settings: AppSettings
  friends: Friend[]
  starting: boolean
  onStart: () => void
  onAddFriend: (friend: Friend) => Promise<void>
  onRemoveFriend: (friendId: string) => Promise<void>
  onJoin: (invite: string) => Promise<void>
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-7">
      <section className="app-enter flex items-end justify-between gap-8 pt-1" aria-labelledby="home-title">
        <div className="max-w-xl">
          <h1 id="home-title" className="font-heading text-[30px] leading-tight font-medium tracking-[-0.045em]">Compartilhamento de tela para amigos</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-6 text-muted-foreground">Escolha um monitor ou janela e transmita para até quatro pessoas na sua sala privada.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <JoinDialog onJoin={onJoin} />
          <Button size="lg" className="h-11 px-5" disabled={starting || settings.audioMode !== "none"} onClick={onStart}>
            {starting ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={ScreenShareIcon} data-icon="inline-start" />}
            {starting ? "Abrindo captura" : "Compartilhar tela"}
          </Button>
        </div>
      </section>

      {settings.audioMode !== "none" && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">A captura de áudio WASAPI está em validação. Selecione “Sem áudio” nas configurações para iniciar a transmissão de vídeo.</p>
      )}

      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] gap-5">
        <Card className="app-enter-media min-h-[370px] gap-0 overflow-hidden border-border/60 py-0 ring-0">
          <div className="preview-grid relative flex min-h-[370px] flex-1 items-center justify-center overflow-hidden bg-[#121315]">
            <div className="absolute top-5 left-5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              Prévia da captura
            </div>
            <div className="flex max-w-xs flex-col items-center text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-border bg-card/80">
                <HugeiconsIcon icon={ComputerScreenShareIcon} className="size-7 text-foreground" />
              </div>
              <h2 className="font-heading text-lg font-medium tracking-[-0.03em]">Sua tela aparece aqui</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">O Windows perguntará qual monitor ou janela você quer compartilhar.</p>
            </div>
            <div className="absolute right-5 bottom-5 flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={SecurityCheckIcon} className="size-4" />
              DTLS-SRTP em cada conexão
            </div>
          </div>
          <CardFooter className="justify-between border-t border-border bg-card py-4 text-xs text-muted-foreground">
            <span>{settings.mode === "smooth" ? "Motion · até 60 fps · 8 Mbps" : "Text · até 30 fps · 6 Mbps"}</span>
            <span>WebRTC + STUN/TURN</span>
          </CardFooter>
        </Card>

        <Card className="min-h-[370px] border-border/60 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HugeiconsIcon icon={UserGroupIcon} className="size-5 text-muted-foreground" />{settings.roomName}</CardTitle>
            <CardDescription>Sala privada permanente</CardDescription>
            <Badge variant="secondary" className="absolute right-6">{friends.length} {friends.length === 1 ? "amigo" : "amigos"}</Badge>
          </CardHeader>
          <CardContent className="flex-1">
            {friends.length === 0 ? (
              <Empty className="h-full min-h-[180px] border-0 p-3">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><HugeiconsIcon icon={UserAddIcon} /></EmptyMedia>
                  <EmptyTitle className="text-base">Nenhum amigo pareado</EmptyTitle>
                  <EmptyDescription>Crie um convite e envie para quem poderá entrar nesta sala.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Amigos pareados">
                {friends.map((friend) => (
                  <li key={friend.friendId} className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 p-2.5">
                    <Avatar size="sm"><AvatarFallback>{friend.displayName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{friend.displayName}</p>
                      <p className="text-xs text-muted-foreground">Pareado · presença offline</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remover ${friend.displayName}`} onClick={() => void onRemoveFriend(friend.friendId)}><HugeiconsIcon icon={Delete01Icon} /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4">
            <FriendsDialog displayName={settings.displayName} onAdd={onAddFriend} />
          </CardFooter>
        </Card>
      </div>

      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" />2 saídas diretas por padrão</span>
        <span>Relays somente com consentimento</span>
        <span>Máximo de 2 saltos</span>
      </div>
    </div>
  )
}

function JoinDialog({ onJoin }: { onJoin: (invite: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const join = async () => {
    setBusy(true)
    setError("")
    try {
      await onJoin(value)
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar na transmissão.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="h-11" />}><HugeiconsIcon icon={Link01Icon} data-icon="inline-start" />Entrar com convite</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em uma transmissão</DialogTitle>
          <DialogDescription>Cole o convite completo enviado pelo host. Ele contém o segredo efêmero desta sessão.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="session-invite">Convite da sessão</FieldLabel>
            <Input id="session-invite" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Cole o convite recebido" aria-invalid={!!error} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </Field>
          <Button disabled={busy || !value.trim()} onClick={() => void join()}>{busy && <Spinner data-icon="inline-start" />}Assistir transmissão</Button>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  )
}

const UserAddIcon = UserGroupIcon
