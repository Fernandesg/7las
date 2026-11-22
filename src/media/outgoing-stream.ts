import type { RoomSession } from "@/lib/room"
import type { StreamMetadata } from "@/media/protocol"

export class OutgoingStream {
  private session: RoomSession
  readonly stream: MediaStream
  readonly childId: string
  readonly metadata: StreamMetadata

  constructor(session: RoomSession, stream: MediaStream, childId: string, metadata: StreamMetadata) {
    this.session = session
    this.stream = stream
    this.childId = childId
    this.metadata = metadata
  }

  async publish(): Promise<void> {
    await this.session.room.addStream(this.stream, { target: this.childId, metadata: this.metadata })
  }

  close(): void {
    this.session.room.removeStream(this.stream, { target: this.childId })
  }
}
