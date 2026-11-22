import { describe, expect, it } from "vitest"
import { acceptsStream, isStreamMetadata, isTreeAssignment, type StreamMetadata, type TreeAssignment } from "@/media/protocol"

const assignment: TreeAssignment = {
  type: "tree.assign",
  sessionId: "session",
  treeEpoch: 3,
  childId: "child",
  parentId: "parent",
  parentTrysteroId: "parent",
  depth: 2,
  reason: "join",
  expiresAt: Date.now() + 10_000,
}

const metadata: StreamMetadata = {
  kind: "screen",
  sessionId: "session",
  originHostId: "host",
  parentId: "parent",
  treeEpoch: 3,
}

describe("session protocol", () => {
  it("valida atribuições e metadata", () => {
    expect(isTreeAssignment(assignment)).toBe(true)
    expect(isStreamMetadata(metadata)).toBe(true)
  })

  it("rejeita stream de outro pai", () => {
    expect(acceptsStream({ ...metadata, parentId: "stranger" }, { sessionId: "session", originHostId: "host", parentId: "parent" }, 0)).toBe(false)
  })

  it("rejeita sessão e epoch antigos", () => {
    expect(acceptsStream({ ...metadata, sessionId: "old" }, { sessionId: "session", originHostId: "host", parentId: "parent" }, 0)).toBe(false)
    expect(acceptsStream({ ...metadata, treeEpoch: 2 }, { sessionId: "session", originHostId: "host", parentId: "parent" }, 3)).toBe(false)
  })

  it("rejeita profundidade fora do MVP", () => {
    expect(isTreeAssignment({ ...assignment, depth: 3 })).toBe(false)
  })
})
