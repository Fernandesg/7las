import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { AppShell } from "@/components/app-shell"
import { Logo } from "@/components/logo"
import { Notice } from "@/components/notice"
import { Spinner } from "@/components/ui/spinner"
import { addFriend, getSettings, isTauri, listFriends, removeFriend, saveSettings, setAutostart, updateSharingState, updateShortcut } from "@/lib/desktop"
import { MediaSession } from "@/media/media-session"
import { HomeScreen } from "@/screens/home"
import { RoomScreen } from "@/screens/room"
import { SettingsScreen } from "@/screens/settings"
import { ViewerScreen } from "@/screens/viewer"
import type { AppSettings, AppView, Friend, QualityMode, SessionNotice } from "@/types"

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [view, setView] = useState<AppView>("home")
  const [session, setSession] = useState<MediaSession | null>(null)
  const [, setRevision] = useState(0)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<SessionNotice>(null)
  const settingsRef = useRef(settings)
  const sessionRef = useRef(session)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const notify = useCallback((next: SessionNotice) => setNotice(next), [])
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    void Promise.all([getSettings(), listFriends()]).then(([loadedSettings, loadedFriends]) => {
      setSettings(loadedSettings)
      setFriends(loadedFriends)
    }).catch((reason) => notify({ tone: "error", title: "Não foi possível carregar os dados", description: String(reason) }))
  }, [notify])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const stop = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await current.stop()
    setSession(null)
    setView("room")
    await updateSharingState({ live: false, sessionId: null, viewerCount: 0, directOutputs: 0 })
    notify({ tone: "info", title: "Transmissão encerrada" })
  }, [notify])

  const start = useCallback(async () => {
    const currentSettings = settingsRef.current
    if (!currentSettings || starting || sessionRef.current) return
    if (currentSettings.audioMode !== "none") {
      notify({ tone: "error", title: "Áudio nativo ainda não disponível", description: "Selecione “Sem áudio” para concluir o gate de captura de vídeo." })
      return
    }
    setStarting(true)
    try {
      const next = await MediaSession.startHost(currentSettings, refresh, () => {
        setSession(null)
        notify({ tone: "info", title: "Compartilhamento encerrado pelo Windows" })
      })
      setSession(next)
      setView("room")
      notify({ tone: "success", title: "Transmissão iniciada", description: "Copie o convite da sala para um amigo entrar." })
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "NotAllowedError") {
        notify({ tone: "info", title: "Captura cancelada", description: "Nenhuma tela foi compartilhada." })
      } else {
        notify({ tone: "error", title: "Não foi possível compartilhar", description: reason instanceof Error ? reason.message : String(reason) })
      }
    } finally {
      setStarting(false)
    }
  }, [notify, refresh, starting])

  const join = async (code: string) => {
    const currentSettings = settingsRef.current
    if (!currentSettings) return
    const next = await MediaSession.watch(code, currentSettings, refresh, () => {
      notify({ tone: "info", title: "O host encerrou a transmissão" })
      refresh()
    })
    setSession(next)
    setView("room")
  }

  useEffect(() => {
    if (!isTauri) return
    const listeners = [
      listen("tray://share", () => {
        setView(sessionRef.current ? "room" : "home")
        if (!sessionRef.current) notify({ tone: "info", title: "Pronto para compartilhar", description: "Clique em “Compartilhar tela” para abrir o seletor do Windows." })
      }),
      listen("tray://room", () => setView("room")),
      listen("tray://settings", () => setView("settings")),
      listen("tray://stop", () => void stop()),
    ]
    return () => {
      void Promise.all(listeners).then((unlisteners) => unlisteners.forEach((unlisten) => unlisten()))
    }
  }, [notify, stop])

  useEffect(() => {
    void updateSharingState({
      live: session?.status === "live",
      sessionId: session?.id || null,
      viewerCount: session?.viewers.length ?? 0,
      directOutputs: session?.directOutputs ?? 0,
    }).catch(() => undefined)
  })

  if (!settings) {
    return <div className="flex h-svh flex-col items-center justify-center gap-5 bg-background"><Logo /><Spinner /><p className="text-sm text-muted-foreground">Abrindo sua sala</p></div>
  }

  const title = view === "home" ? "Início" : view === "settings" ? "Configurações" : session?.role === "viewer" ? "Assistindo" : "Sala ao vivo"
  const subtitle = view === "home" ? settings.roomName : view === "settings" ? "Preferências desta instalação" : session ? "Sessão privada por convite" : "Nenhuma sessão ativa"

  return (
    <>
      <AppShell view={view} onView={setView} live={session?.status === "live"} title={title} subtitle={subtitle}>
        {view === "home" && <HomeScreen settings={settings} friends={friends} starting={starting} onStart={() => void start()} onJoin={join} onAddFriend={async (friend) => {
          setFriends(await addFriend(friend))
          notify({ tone: "success", title: `${friend.displayName} foi adicionado` })
        }} onRemoveFriend={async (friendId) => {
          setFriends(await removeFriend(friendId))
          notify({ tone: "info", title: "Amigo removido" })
        }} />}
        {view === "settings" && <SettingsScreen settings={settings} onSave={async (next) => {
          const saved = await saveSettings(next)
          await setAutostart(saved.startWithWindows)
          await updateShortcut(saved.globalShortcut)
          setSettings(saved)
          notify({ tone: "success", title: "Configurações salvas" })
        }} />}
        {view === "room" && (session?.role === "viewer" ? <ViewerScreen session={session} onStop={() => void stop()} /> : <RoomScreen session={session} settings={settings} onStart={() => void start()} onStop={() => void stop()} onMode={(mode: QualityMode) => session?.setMode(mode)} />)}
      </AppShell>
      <Notice notice={notice} />
    </>
  )
}
