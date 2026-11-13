const SEED_RANGE = { MIN: 0, MAX: 1_000_000_000 } as const
import type { EntityReference } from './types'

export const BATCH_PATH = '/_/AiSandboxAngularFrontend/data/batchexecute'
export const FLOW_BASE_URL = 'https://flow.google.com'
export const MEDIA_HOST = 'flow-content.google'

export const RPC_GEN_IMAGE = 'ogiZ0b'
export const RPC_GEN_VIDEO = 'eb1hJf'
export const RPC_OPERATION = 'jwpduf'
export const RPC_PROJECT_MEDIA = 'Zzl0ze'
export const RPC_MEDIA = 'as29s'
export const RPC_UPLOAD_IMAGE = 'maseQ'
export const RPC_CREATE_CHARACTER = 'C4BZMd'

export const CAPTCHA_IMAGE = 'IMAGE_GENERATION'
export const CAPTCHA_VIDEO = 'VIDEO_GENERATION'
export const CAPTCHA_SLOT = '__CAPTCHA__'

export const IMAGE_MODELS = new Set(['GEM_PIX_2', 'NARWHAL', 'HARBOR_SEAL', 'IMAGEN_3'])
export const IMAGE_MODEL = 'GEM_PIX_2'

export const ASPECT_SQUARE = 1 // 1024x1024
export const ASPECT_PORTRAIT = 2 // 768x1376 (9:16)
export const ASPECT_LANDSCAPE = 3 // 1376x768 (16:9)
export const ASPECT_PORTRAIT_4_3 = 4 // 896x1200 (3:4)
export const ASPECT_LANDSCAPE_4_3 = 5 // 1200x896 (4:3)

export const ASPECT_BY_NAME: Record<string, number> = {
  IMAGE_ASPECT_RATIO_SQUARE: ASPECT_SQUARE,
  IMAGE_ASPECT_RATIO_PORTRAIT: ASPECT_PORTRAIT,
  IMAGE_ASPECT_RATIO_LANDSCAPE: ASPECT_LANDSCAPE,
  IMAGE_ASPECT_RATIO_PORTRAIT_FOUR_THREE: ASPECT_PORTRAIT_4_3,
  IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE: ASPECT_LANDSCAPE_4_3,
  SQUARE: ASPECT_SQUARE,
  PORTRAIT: ASPECT_PORTRAIT,
  LANDSCAPE: ASPECT_LANDSCAPE,
  PORTRAIT_3_4: ASPECT_PORTRAIT_4_3,
  LANDSCAPE_4_3: ASPECT_LANDSCAPE_4_3,
  '1:1': ASPECT_SQUARE,
  '9:16': ASPECT_PORTRAIT,
  '16:9': ASPECT_LANDSCAPE,
  '3:4': ASPECT_PORTRAIT_4_3,
  '4:3': ASPECT_LANDSCAPE_4_3
}

export const SURFACE_ID = 22
export const FULL_FRAME_CROP = [null, 0.0038759689922481244, 1, 0.9961240310077519]
export const REF_TYPE_IMAGE = 1

export const VIDEO_MODEL = 'veo_3_1_i2v_lite_low_priority'
export const VIDEO_MODELS = new Set([
  'veo_3_1_i2v_lite_low_priority',
  'veo_3_1_i2v_lite',
  'veo_3_1_i2v_s_fast',
  'veo_3_1_i2v_s_fast_ultra'
])

export function resolveVideoModel(model?: string): string {
  if (!model) return VIDEO_MODEL
  if (VIDEO_MODELS.has(model)) return model
  if (model.includes('ultra')) return 'veo_3_1_i2v_s_fast_ultra'
  if (model.includes('lite_low_priority')) return 'veo_3_1_i2v_lite_low_priority'
  if (model.includes('lite')) return 'veo_3_1_i2v_lite'
  if (model.includes('fast')) return 'veo_3_1_i2v_s_fast'
  return VIDEO_MODEL
}

export const VIDEO_ASPECT_PORTRAIT = 1 // 720x1280 (9:16)
export const VIDEO_ASPECT_LANDSCAPE = 2 // 1280x720 (16:9)

export const VIDEO_ASPECT_BY_NAME: Record<string, number> = {
  VIDEO_ASPECT_RATIO_PORTRAIT: VIDEO_ASPECT_PORTRAIT,
  VIDEO_ASPECT_RATIO_LANDSCAPE: VIDEO_ASPECT_LANDSCAPE,
  '9:16': VIDEO_ASPECT_PORTRAIT,
  '16:9': VIDEO_ASPECT_LANDSCAPE
}

export function resolveVideoAspect(aspect?: any): number {
  if (typeof aspect === 'number') {
    if (aspect === VIDEO_ASPECT_PORTRAIT || aspect === VIDEO_ASPECT_LANDSCAPE) return aspect
    return VIDEO_ASPECT_PORTRAIT
  }
  if (typeof aspect === 'string' && VIDEO_ASPECT_BY_NAME[aspect]) {
    return VIDEO_ASPECT_BY_NAME[aspect]
  }
  return VIDEO_ASPECT_PORTRAIT
}

export interface RpcResult {
  rpcid: string
  data: any
  error?: any
  ok: boolean
}

export interface GeneratedImage {
  mediaId: string
  url: string
}

export function buildEnvelope(rpcid: string, inner: any): string {
  return JSON.stringify([[[rpcid, JSON.stringify(inner), null, 'generic']]])
}

export function parseEnvelope(text: string): RpcResult[] {
  if (!text) return []
  const body = text.startsWith(")]}'") ? text.slice(text.indexOf('\n') + 1) : text
  const results: RpcResult[] = []

  let index = 0
  while (index < body.length) {
    const start = body.indexOf('[', index)
    if (start === -1) break

    let consumed = 0
    let chunk: any = null
    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < body.length; i++) {
      const char = body[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (!inString) {
        if (char === '[') depth++
        else if (char === ']') {
          depth--
          if (depth === 0) {
            consumed = i + 1 - start
            try {
              chunk = JSON.parse(body.slice(start, start + consumed))
            } catch {
              chunk = null
            }
            break
          }
        }
      }
    }

    if (!chunk || consumed === 0) {
      index = start + 1
      continue
    }

    index = start + consumed
    if (Array.isArray(chunk)) {
      for (const entry of chunk) {
        if (!Array.isArray(entry) || entry.length === 0 || entry[0] !== 'wrb.fr') {
          continue
        }
        const rpcid = entry[1] || '?'
        const payload = entry[2]
        if (payload === null || payload === undefined) {
          results.push({
            rpcid,
            data: null,
            error: entry[5] ?? true,
            ok: false
          })
          continue
        }
        let parsedPayload = payload
        if (typeof payload === 'string') {
          try {
            parsedPayload = JSON.parse(payload)
          } catch {
            parsedPayload = payload
          }
        }
        results.push({
          rpcid,
          data: parsedPayload,
          error: undefined,
          ok: true
        })
      }
    }
  }

  return results
}

export function firstPayload(text: string, rpcid: string): any {
  const results = parseEnvelope(text)
  for (const res of results) {
    if (res.rpcid !== rpcid) continue
    if (!res.ok) {
      throw new Error(`Google Flow RPC ${rpcid} failed: ${JSON.stringify(res.error)}`)
    }
    return res.data
  }
  throw new Error(`No ${rpcid} envelope found in response (${results.length} envelopes parsed)`)
}

function clientUuid(): string {
  return globalThis.crypto.randomUUID().toUpperCase()
}

function flowContext(projectId: string): any[] {
  return [
    null,
    SURFACE_ID,
    null,
    null,
    null,
    projectId,
    null,
    null,
    null,
    null,
    [CAPTCHA_SLOT, 1]
  ]
}

function flowReference(mediaId: string): any[] {
  return [mediaId, null, null, null, REF_TYPE_IMAGE]
}

export interface FlowStructuredPromptResult {
  promptWire: any[]
  characterIds: string[]
  propMediaIds: string[]
}

/**
 * Builds structured prompt tokens according to Google Flow Wire Protobuf specifications.
 * - Character Entity (from Character Studio): [null, [null, null, [characterId, characterName]]]
 * - Prop / Reference Image: [null, [[mediaId, propName]]]
 * - Plain text: [textChunk]
 */
export function buildFlowStructuredPrompt(
  prompt: string,
  entities?: EntityReference[]
): FlowStructuredPromptResult {
  if (!prompt || !entities || entities.length === 0) {
    return {
      promptWire: [[[prompt || '']]],
      characterIds: [],
      propMediaIds: []
    }
  }

  const sortedEntities = [...entities].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
  )

  const hasMarkdownMentions = /(?:@)?\[([^\]]+)\](?:\(([^)]+)\))?/.test(prompt)
  const tokens: any[] = []
  const characterIds: string[] = []
  const propMediaIds: string[] = []

  const addEntityToken = (entity: EntityReference, displayName?: string) => {
    const name = displayName || entity.name
    const isChar = entity.kind === 'CHARACTER' || Boolean(entity.refCharId)
    if (isChar) {
      const charId = entity.refCharId || entity.id
      tokens.push([null, [null, null, [charId, name]]])
      if (!characterIds.includes(charId)) characterIds.push(charId)
    } else {
      const mediaId = entity.refPropId || entity.refId
      tokens.push([null, [[mediaId, name]]])
      if (!propMediaIds.includes(mediaId)) propMediaIds.push(mediaId)
    }
  }

  if (hasMarkdownMentions) {
    const regex = /(?:@)?\[([^\]]+)\](?:\(([^)]+)\))?/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(prompt)) !== null) {
      const matchIndex = match.index
      const matchedText = match[0]
      const entityName = match[1]
      const entityId = match[2]

      if (matchIndex > lastIndex) {
        const textChunk = prompt.slice(lastIndex, matchIndex)
        if (textChunk) tokens.push([textChunk])
      }

      let entity = entityId
        ? entities.find(
            (e) =>
              e.id === entityId ||
              e.refCharId === entityId ||
              e.refPropId === entityId
          )
        : null
      if (!entity) {
        entity = entities.find((e) => e.name.toLowerCase() === entityName.trim().toLowerCase())
      }

      if (entity) {
        addEntityToken(entity, entityName)
      } else {
        tokens.push([matchedText])
      }
      lastIndex = matchIndex + matchedText.length
    }
    if (lastIndex < prompt.length) {
      tokens.push([prompt.slice(lastIndex)])
    }
  } else {
    // Plain text matching by entity names
    const escapedNames = sortedEntities
      .map((e) => e.name?.trim())
      .filter((n): n is string => Boolean(n && n.length > 0))
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    if (escapedNames.length === 0) {
      return {
        promptWire: [[[prompt]]],
        characterIds: [],
        propMediaIds: []
      }
    }

    const regex = new RegExp(`(?:@)?(?:${escapedNames.join('|')})`, 'gi')
    let lastIndex = 0
    let match: RegExpExecArray | null
    let matchedAny = false

    while ((match = regex.exec(prompt)) !== null) {
      matchedAny = true
      const matchIndex = match.index
      const matchedText = match[0]
      const rawName = matchedText.startsWith('@') ? matchedText.slice(1) : matchedText

      if (matchIndex > lastIndex) {
        const textChunk = prompt.slice(lastIndex, matchIndex)
        if (textChunk) tokens.push([textChunk])
      }

      const entity = sortedEntities.find(
        (e) => e.name.toLowerCase() === rawName.trim().toLowerCase()
      )
      if (entity) {
        addEntityToken(entity, entity.name)
      } else {
        tokens.push([matchedText])
      }
      lastIndex = matchIndex + matchedText.length
    }

    if (!matchedAny) {
      return {
        promptWire: [[[prompt]]],
        characterIds: [],
        propMediaIds: []
      }
    }

    if (lastIndex < prompt.length) {
      tokens.push([prompt.slice(lastIndex)])
    }
  }

  // Ensure trailing whitespace token if last token was an entity
  const lastToken = tokens[tokens.length - 1]
  if (lastToken && lastToken[0] === null) {
    tokens.push([' '])
  }

  return {
    promptWire: [tokens],
    characterIds,
    propMediaIds
  }
}

export interface BuildImageRequestOptions {
  prompt: string
  projectId: string
  count?: number
  aspect?: any
  seed?: number
  model?: string
  refIds?: string[]
  characterId?: string
  characterIds?: string[]
  entities?: EntityReference[]
}

export function buildImageRequest(options: BuildImageRequestOptions): string {
  const {
    prompt,
    projectId,
    count = 1,
    aspect = ASPECT_SQUARE,
    seed,
    model = IMAGE_MODEL,
    refIds,
    characterId,
    characterIds,
    entities
  } = options

  const ratio = typeof aspect === 'number' ? aspect : (ASPECT_BY_NAME[aspect] || ASPECT_SQUARE)
  const baseSeed =
    seed !== undefined && seed !== null
      ? seed
      : Math.floor(Math.random() * (SEED_RANGE.MAX - SEED_RANGE.MIN + 1)) + SEED_RANGE.MIN

  // 1. Build structured tokens and collect character & prop IDs
  const structured = buildFlowStructuredPrompt(prompt, entities)
  const combinedRefIds = Array.from(
    new Set([...(refIds || []), ...structured.propMediaIds])
  )
  const combinedCharIds = Array.from(
    new Set([...(characterIds || []), ...structured.characterIds])
  )

  const items: any[] = []
  const total = Math.max(1, count)

  for (let i = 0; i < total; i++) {
    // Slot 2: Prop and reference images
    const refs = combinedRefIds.length > 0 ? combinedRefIds.map(flowReference) : null
    // Slot 10: Character entity IDs
    const charSlot = combinedCharIds.length > 0 ? combinedCharIds.map((id) => [id]) : null

    items.push([
      null,
      null,
      refs,
      baseSeed + i * 9973,
      ratio,
      model,
      null,
      flowContext(projectId),
      structured.promptWire,
      null,
      charSlot,
      null,
      clientUuid(),
      clientUuid()
    ])
  }

  const trailer = characterId
    ? [clientUuid(), null, [characterId, [0]]]
    : [clientUuid()]

  const inner = [null, items, 1, flowContext(projectId), trailer]

  return buildEnvelope(RPC_GEN_IMAGE, inner)
}

export function buildCreateCharacterRequest(projectId: string, name: string): string {
  const inner = [[projectId, null, null, [1, name || 'Nhân vật chưa có tên', []]]]
  return buildEnvelope(RPC_CREATE_CHARACTER, inner)
}

export interface CreatedCharacterResult {
  projectId: string
  characterId: string
  name: string
  activeMediaId?: string | null
}

export function readCreatedCharacter(payload: any): CreatedCharacterResult {
  const record = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : null
  if (!record || !record[1]) {
    throw new Error(`Google Flow failed to create character entity: ${JSON.stringify(payload)}`)
  }
  return {
    projectId: record[0],
    characterId: record[1],
    activeMediaId: record[2] || null,
    name: record[3]?.[1] || ''
  }
}

export function readImages(payload: any): GeneratedImage[] {
  const images: GeneratedImage[] = []
  const seen = new Set<string>()

  function walk(node: any) {
    if (typeof node === 'string') {
      if (node.includes(MEDIA_HOST + '/image/')) {
        const parts = node.split('/image/')
        if (parts[1]) {
          const mediaId = parts[1].split('?')[0]
          if (mediaId && !seen.has(mediaId)) {
            seen.add(mediaId)
            images.push({ mediaId, url: node })
          }
        }
      }
    } else if (Array.isArray(node)) {
      for (const item of node) walk(item)
    } else if (node && typeof node === 'object') {
      for (const val of Object.values(node)) walk(val)
    }
  }

  walk(payload)
  return images
}

export interface BuildVideoRequestOptions {
  prompt: string
  projectId: string
  sourceMediaId: string
  crop?: any[]
  aspect?: any
  model?: string
}

export function buildVideoRequest(options: BuildVideoRequestOptions): string {
  const {
    prompt,
    projectId,
    sourceMediaId,
    crop = FULL_FRAME_CROP,
    aspect = VIDEO_ASPECT_PORTRAIT,
    model = VIDEO_MODEL
  } = options

  const inner = [
    [
      [
        [null, null, [[[prompt]]]],
        resolveVideoModel(model),
        resolveVideoAspect(aspect),
        null,
        [null, sourceMediaId, null, null, null, crop || FULL_FRAME_CROP],
        [null, null, null, null, clientUuid(), clientUuid()]
      ]
    ],
    flowContext(projectId),
    [clientUuid(), 2]
  ]

  return buildEnvelope(RPC_GEN_VIDEO, inner)
}

export function buildOperationRequest(operationId: string): string {
  return buildEnvelope(RPC_OPERATION, [null, null, [[operationId]]])
}

export interface FlowOperation {
  operationId: string
  projectId?: string
  status?: string
  error?: string
  done: boolean
}

export function readOperation(payload: any): FlowOperation {
  let record: any = null
  if (Array.isArray(payload)) {
    if (typeof payload[0] === 'string') {
      record = payload
    } else if (Array.isArray(payload[3]) && Array.isArray(payload[3][0])) {
      record = payload[3][0]
    } else if (Array.isArray(payload[2]) && Array.isArray(payload[2][0])) {
      record = payload[2][0]
    } else if (Array.isArray(payload[0])) {
      record = payload[0]
    }
  }

  if (!record || !Array.isArray(record)) {
    throw new Error(`Unexpected operation payload: ${JSON.stringify(payload)}`)
  }

  const operationId = record[0]
  if (typeof operationId !== 'string' || !operationId) {
    throw new Error(`Operation payload missing id: ${JSON.stringify(payload)}`)
  }

  const status = record[3] ? String(record[3]) : (record[1] ? String(record[1]) : undefined)
  const done =
    status === 'CAE' ||
    status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL'
  const resultObj = record[3]

  return {
    operationId,
    status,
    done,
    error: resultObj && resultObj.error ? JSON.stringify(resultObj.error) : undefined
  }
}

export function readMediaUrls(payload: any): string[] {
  const urls: string[] = []
  function walk(node: any) {
    if (typeof node === 'string') {
      const clean = node.replace(/\\\//g, '/')
      if (
        clean.startsWith('http://') ||
        clean.startsWith('https://') ||
        clean.includes(MEDIA_HOST)
      ) {
        urls.push(clean)
      }
    } else if (Array.isArray(node)) {
      for (const item of node) walk(item)
    } else if (node && typeof node === 'object') {
      for (const val of Object.values(node)) walk(val)
    }
  }
  walk(payload)
  return urls
}

export function buildProjectMediaRequest(projectId: string): string {
  return buildEnvelope(RPC_PROJECT_MEDIA, [`projects/${projectId}`, null, null, null, [1]])
}

export function findMediaIdInText(text: string, operationId: string): string | null {
  if (!text || !operationId) return null
  const start = text.indexOf(operationId)
  if (start === -1) return null
  const sub = text.slice(start, start + 800)
  const match = sub.match(/null,null,\\?"([0-9a-fA-F-]{36})\\?"/)
  return match ? match[1] : null
}
