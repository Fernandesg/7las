import { MODES } from "@/lib/tuning"
import type { QualityMode } from "@/types"

declare class CaptureController {
  setFocusBehavior(behavior: "focus-captured-surface" | "no-focus-change"): void
}

export const canShare = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)

export async function captureScreen(controller?: CaptureController): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
    controller,
    surfaceSwitching: "include",
    selfBrowserSurface: "exclude",
    monitorTypeSurfaces: "include",
  } as DisplayMediaStreamOptions)
}

export function applyContentHint(track: MediaStreamTrack | undefined, mode: QualityMode): void {
  if (track) track.contentHint = MODES[mode].hint
}

export function newCaptureController() {
  if (typeof CaptureController === "undefined") return undefined
  const controller = new CaptureController()
  return {
    controller,
    stayHere: () => {
      try {
        controller.setFocusBehavior("no-focus-change")
      } catch {
        return
      }
    },
  }
}
