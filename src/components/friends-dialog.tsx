import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Copy01Icon, Tick02Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPublicKey } from "@/lib/desktop"
import { createFriendInvite, parseFriendInvite } from "@/lib/invite"
import type { Friend } from "@/types"

export function FriendsDialog({ displayName, onAdd }: { displayName: string; onAdd: (friend: Friend) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [invite, setInvite] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      setInvite(createFriendInvite(displayName, await getPublicKey()))
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    setError("")
    setBusy(true)
    try {
      await onAdd(parseFriendInvite(code))
      setCode("")
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aceitar o convite.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" />Adicionar amigo</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pareamento de amigos</DialogTitle>
          <DialogDescription>Troque um convite de uso único com validade de 15 minutos. A chave pública identifica a instalação.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="accept">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accept">Aceitar convite</TabsTrigger>
            <TabsTrigger value="create">Criar convite</TabsTrigger>
          </TabsList>
          <TabsContent value="accept" className="pt-5">
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="friend-code">Código do convite</FieldLabel>
                <Input id="friend-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Cole o código recebido" aria-invalid={!!error} aria-describedby={error ? "friend-code-error" : undefined} />
                {error && <FieldDescription id="friend-code-error" className="text-destructive">{error}</FieldDescription>}
              </Field>
              <Button disabled={!code.trim() || busy} onClick={() => void accept()}><HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />Adicionar amigo</Button>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="create" className="pt-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="own-invite">Seu convite</FieldLabel>
                <Input id="own-invite" readOnly value={invite} placeholder="Gere um código para compartilhar" onFocus={(event) => event.currentTarget.select()} />
                <FieldDescription>O código expira automaticamente e não contém sua chave privada.</FieldDescription>
              </Field>
              {invite ? (
                <Button onClick={() => void navigator.clipboard.writeText(invite).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })}>
                  <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} data-icon="inline-start" />{copied ? "Convite copiado" : "Copiar convite"}
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void create()}>Gerar convite</Button>
              )}
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
