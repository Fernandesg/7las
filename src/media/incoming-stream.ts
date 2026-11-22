export class IncomingStream {
  private current: MediaStream | null = null

  get stream(): MediaStream | null {
    return this.current
  }

  transition(next: MediaStream): MediaStream {
    const previous = this.current
    this.current = next
    if (previous && previous !== next) {
      for (const track of previous.getTracks()) track.stop()
    }
    return next
  }

  clear(): void {
    this.current = null
  }
}
