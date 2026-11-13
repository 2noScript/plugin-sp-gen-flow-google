import type { Connection, EntityReference } from './types'
import type {
  GenerationCharacterPayload,
  GenerationCharacterResponse,
  GenerationPropPayload,
  GenerationPropResponse,
  GenerationEnvironmentPayload,
  GenerationEnvironmentResponse,
  GenerationImagePayload,
  GenerationImageResponse,
  GenerationVideoPayload,
  GenerationVideoResponse
} from './types'
import type { IFlowGoogleDriver } from './types'
import type { HttpRequestOptions } from './types'
import { BaseGenerationService } from './validation'
import {
  buildImageRequest,
  buildVideoRequest,
  buildOperationRequest,
  buildEnvelope,
  firstPayload,
  readImages,
  readOperation,
  readMediaUrls,
  RPC_GEN_IMAGE,
  RPC_GEN_VIDEO,
  RPC_OPERATION,
  RPC_MEDIA,
  RPC_CREATE_CHARACTER,
  buildCreateCharacterRequest,
  readCreatedCharacter,
  CAPTCHA_SLOT
} from './rpc'

export class FlowGoogleService extends BaseGenerationService {
  constructor(private driver: IFlowGoogleDriver, private requestText: (url: string, options: HttpRequestOptions) => Promise<string>) {
    super()
  }

  private async executeImageRpc(
    profile: Connection,
    params: {
      prompt: string
      model: string
      ratio: string
      seed?: number
      proxy?: string
      refIds?: string[]
      entities?: EntityReference[]
      targetType: 'character' | 'prop' | 'environment' | 'image'
      name?: string
      characterId?: string
      sourcePath?: string
    }
  ): Promise<GenerationImageResponse> {
    const proxy = params.proxy

    // 1. Solve reCAPTCHA Enterprise via Webview DOM (runs direct & fast)
    const captchaResult = await this.driver.solveRecaptcha(
      profile,
      '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV',
      'IMAGE_GENERATION'
    )
    if (!captchaResult.success || !captchaResult.token) {
      throw new Error(`Failed to solve reCAPTCHA for Google Flow: ${captchaResult.error}`)
    }

    // 2. Extract page auth context (at, sid, bl, projectId, cookies) from Webview session
    const auth = await this.driver.getFlowAuthContext(profile)

    // 3. Build Google Flow request with exact payload parameters (combining refIds, props, and environments)
    const combinedRefIds = Array.from(
      new Set([
        ...(params.refIds || []),
        ...(params.entities || [])
          .filter((e) => e.kind !== 'CHARACTER')
          .map((e) => e.refPropId || e.refEnvId || e.refId)
          .filter(Boolean) as string[]
      ])
    )

    const rawFreq = buildImageRequest({
      prompt: params.prompt,
      projectId: auth.projectId,
      count: 1,
      aspect: params.ratio,
      seed: params.seed,
      model: params.model,
      refIds: combinedRefIds.length > 0 ? combinedRefIds : undefined,
      characterId: params.characterId,
      entities: params.entities
    })

    const freqStr = rawFreq.split(CAPTCHA_SLOT).join(captchaResult.token)
    const reqid = Math.floor(Math.random() * 900000) + 100000
    const sourcePath =
      params.sourcePath ||
      (params.characterId
        ? `/project/${auth.projectId}/character/${params.characterId}`
        : `/project/${auth.projectId}`)
    const batchUrl =
      `https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(RPC_GEN_IMAGE)}` +
      `&source-path=${encodeURIComponent(sourcePath)}` +
      `&f.sid=${encodeURIComponent(auth.sid || '')}&bl=${encodeURIComponent(auth.bl || '')}` +
      `&hl=en&_reqid=${reqid}&rt=c`

    const bodyParams = new URLSearchParams()
    bodyParams.set('f.req', freqStr)
    bodyParams.set('at', auth.at)

    // 4. Execute RPC via generic requestText
    const text = await this.requestText(batchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        origin: 'https://flow.google.com',
        'x-same-domain': '1',
        cookie: auth.cookieString,
        referer: profile.url
      },
      body: bodyParams.toString(),
      proxy
    })

    const innerPayload = firstPayload(text, RPC_GEN_IMAGE)
    const images = readImages(innerPayload)

    if (!images || images.length === 0) {
      throw new Error(`Google Flow returned no images in response: ${JSON.stringify(innerPayload)}`)
    }

    const firstImage = images[0]
    return {
      url: firstImage.url,
      refId: firstImage.mediaId,
      seed: params.seed ?? 0,
      prompt: params.prompt,
      metadata: {
        targetType: params.targetType,
        providerId: 'FLOW_GOOGLE',
        projectId: auth.projectId,
        model: params.model,
        name: params.name,
        characterId: params.characterId
      }
    }
  }

  public async createCharacterEntity(
    profile: Connection,
    name: string,
    proxy?: string
  ): Promise<{ characterId: string; projectId: string }> {
    const auth = await this.driver.getFlowAuthContext(profile)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(auth.projectId)) {
      throw new Error(
        `Google Flow requires a valid project UUID. Current projectId is '${auth.projectId}'. Please ensure profile is inside an active Google Flow project.`
      )
    }

    const freqStr = buildCreateCharacterRequest(auth.projectId, name)
    const reqid = Math.floor(Math.random() * 900000) + 100000
    const sourcePath = `/project/${auth.projectId}/character`
    const batchUrl =
      `https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(RPC_CREATE_CHARACTER)}` +
      `&source-path=${encodeURIComponent(sourcePath)}` +
      `&f.sid=${encodeURIComponent(auth.sid || '')}&bl=${encodeURIComponent(auth.bl || '')}` +
      `&hl=en&_reqid=${reqid}&rt=c`

    const bodyParams = new URLSearchParams()
    bodyParams.set('f.req', freqStr)
    bodyParams.set('at', auth.at)

    const text = await this.requestText(batchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        origin: 'https://flow.google.com',
        'x-same-domain': '1',
        cookie: auth.cookieString,
        referer: `https://flow.google.com/project/${auth.projectId}/character`
      },
      body: bodyParams.toString(),
      proxy
    })

    const innerPayload = firstPayload(text, RPC_CREATE_CHARACTER)
    const created = readCreatedCharacter(innerPayload)
    return {
      characterId: created.characterId,
      projectId: auth.projectId
    }
  }

  public async generateCharacter(
    profile: Connection,
    payload: GenerationCharacterPayload
  ): Promise<GenerationCharacterResponse> {
    this.validateBasePayload(payload, 'Google Flow', 'character generation')

    const charName = payload.name || 'Nhân vật chưa có tên'

    // 1. Create native Character Entity on Google Flow (RPC C4BZMd) to obtain characterId
    const { characterId, projectId } = await this.createCharacterEntity(
      profile,
      charName,
      payload.proxy
    )

    // 2. Generate portrait image bound to characterId (RPC ogiZ0b)
    const ratio = payload.ratio
    const res = await this.executeImageRpc(profile, {
      prompt: payload.prompt,
      model: payload.model,
      ratio,
      seed: payload.seed,
      proxy: payload.proxy,
      targetType: 'character',
      name: charName,
      characterId,
      sourcePath: `/project/${projectId}/character/${characterId}`
    })

    return {
      url: res.url,
      refId: res.refId,       // mediaId (UUID của ảnh mẫu)
      refCharId: characterId, // characterId (UUID của thực thể nhân vật)
      name: charName,
      seed: res.seed,
      prompt: res.prompt,
      metadata: {
        targetType: 'character',
        providerId: 'FLOW_GOOGLE',
        projectId,
        refCharId: characterId,
        refId: res.refId,
        model: payload.model,
        ratio,
        ...res.metadata
      }
    }
  }

  public async generateProp(
    profile: Connection,
    payload: GenerationPropPayload
  ): Promise<GenerationPropResponse> {
    this.validateBasePayload(payload, 'Google Flow', 'prop generation')
    const res = await this.executeImageRpc(profile, {
      prompt: payload.prompt,
      model: payload.model,
      ratio: payload.ratio,
      seed: payload.seed,
      proxy: payload.proxy,
      targetType: 'prop',
      name: payload.name
    })
    return {
      url: res.url,
      refId: res.refId,
      refPropId: res.refId,
      name: payload.name,
      seed: res.seed,
      prompt: res.prompt,
      metadata: {
        targetType: 'prop',
        providerId: 'FLOW_GOOGLE',
        refId: res.refId,
        refPropId: res.refId,
        model: payload.model,
        ...res.metadata
      }
    }
  }

  public async generateEnvironment(
    profile: Connection,
    payload: GenerationEnvironmentPayload
  ): Promise<GenerationEnvironmentResponse> {
    this.validateEnvironmentPayload(payload, 'Google Flow')
    const ratio = payload.ratio || '16:9'
    const res = await this.executeImageRpc(profile, {
      prompt: payload.prompt,
      model: payload.model,
      ratio,
      seed: payload.seed,
      proxy: payload.proxy,
      targetType: 'environment',
      name: payload.name
    })
    return {
      url: res.url,
      refId: res.refId,
      refEnvId: res.refId,
      name: payload.name,
      seed: res.seed,
      prompt: res.prompt,
      metadata: {
        targetType: 'environment',
        providerId: 'FLOW_GOOGLE',
        refId: res.refId,
        refEnvId: res.refId,
        model: payload.model,
        ratio,
        ...res.metadata
      }
    }
  }

  public async generateImage(
    profile: Connection,
    payload: GenerationImagePayload
  ): Promise<GenerationImageResponse> {
    this.validateImagePayload(payload, 'Google Flow')
    const res = await this.executeImageRpc(profile, {
      prompt: payload.prompt,
      model: payload.model,
      ratio: payload.ratio,
      seed: payload.seed,
      proxy: payload.proxy,
      refIds: payload.refIds,
      entities: payload.entities,
      targetType: 'image',
      name: payload.name
    })
    return {
      url: res.url,
      refId: res.refId,
      seed: res.seed,
      prompt: res.prompt,
      metadata: {
        targetType: 'image',
        providerId: 'FLOW_GOOGLE',
        model: payload.model,
        ...res.metadata
      }
    }
  }

  public async generateVideo(
    profile: Connection,
    payload: GenerationVideoPayload
  ): Promise<GenerationVideoResponse> {
    this.validateVideoPayload(payload, 'Google Flow')
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    const match = payload.startFrameUrl ? payload.startFrameUrl.match(uuidRegex) : null
    const sourceMediaId = match ? match[0] : payload.refId
    if (!sourceMediaId) {
      throw new Error(
        `Google Flow video generation requires a valid media UUID in 'startFrameUrl' (received: '${payload.startFrameUrl}')`
      )
    }

    const proxy = payload.proxy

    // 1. Solve reCAPTCHA Enterprise for VIDEO_GENERATION via Webview DOM
    const captchaResult = await this.driver.solveRecaptcha(
      profile,
      '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV',
      'VIDEO_GENERATION'
    )
    if (!captchaResult.success || !captchaResult.token) {
      throw new Error(`Failed to solve video reCAPTCHA for Google Flow: ${captchaResult.error}`)
    }

    // 2. Extract page auth context
    const auth = await this.driver.getFlowAuthContext(profile)

    // 3. Build Google Flow video request with exact payload parameters (zero-fallback)
    const rawFreq = buildVideoRequest({
      prompt: payload.prompt,
      projectId: auth.projectId,
      sourceMediaId,
      aspect: payload.ratio,
      model: payload.model
    })

    const freqStr = rawFreq.split(CAPTCHA_SLOT).join(captchaResult.token)
    const reqid = Math.floor(Math.random() * 900000) + 100000
    const sourcePath = `/project/${auth.projectId}`
    const batchUrl =
      `https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(RPC_GEN_VIDEO)}` +
      `&source-path=${encodeURIComponent(sourcePath)}` +
      `&f.sid=${encodeURIComponent(auth.sid || '')}&bl=${encodeURIComponent(auth.bl || '')}` +
      `&hl=en&_reqid=${reqid}&rt=c`

    const bodyParams = new URLSearchParams()
    bodyParams.set('f.req', freqStr)
    bodyParams.set('at', auth.at)

    // 4. Execute video creation RPC via generic requestText
    const text = await this.requestText(batchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        origin: 'https://flow.google.com',
        'x-same-domain': '1',
        cookie: auth.cookieString,
        referer: profile.url
      },
      body: bodyParams.toString(),
      proxy
    })

    const innerPayload = firstPayload(text, RPC_GEN_VIDEO)
    const op = readOperation(innerPayload)

    // 5. Poll operation until completion
    let videoUrl = ''
    let thumbnailUrl: string | undefined
    const maxPolls = 60
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const opFreq = buildOperationRequest(op.operationId)
      const opBatchUrl =
        `https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(RPC_OPERATION)}` +
        `&source-path=${encodeURIComponent(sourcePath)}` +
        `&f.sid=${encodeURIComponent(auth.sid || '')}&bl=${encodeURIComponent(auth.bl || '')}` +
        `&hl=en&_reqid=${Math.floor(Math.random() * 900000) + 100000}&rt=c`

      const opParams = new URLSearchParams()
      opParams.set('f.req', opFreq)
      opParams.set('at', auth.at)

      try {
        const opText = await this.requestText(opBatchUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            origin: 'https://flow.google.com',
            'x-same-domain': '1',
            cookie: auth.cookieString,
            referer: profile.url
          },
          body: opParams.toString(),
          proxy
        })
        const opPayload = firstPayload(opText, RPC_OPERATION)
        const urls = readMediaUrls(opPayload)
        const matched = urls.find((u) => u.includes('/video/') || u.includes('.mp4'))
        if (matched) {
          videoUrl = matched
          thumbnailUrl = urls.find((u) => u.includes('/image/'))
          break
        }
        const latestOp = readOperation(opPayload)
        if (latestOp.done) {
          // Poll RPC_MEDIA (as29s) with op.operationId until signed video URL is available
          const targetMediaId = op.operationId
          const mediaBatchUrl =
            `https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(RPC_MEDIA)}` +
            `&source-path=${encodeURIComponent(sourcePath)}` +
            `&f.sid=${encodeURIComponent(auth.sid || '')}&bl=${encodeURIComponent(auth.bl || '')}` +
            `&hl=en&_reqid=${Math.floor(Math.random() * 900000) + 100000}&rt=c`

          const mediaParams = new URLSearchParams()
          mediaParams.set('f.req', buildEnvelope(RPC_MEDIA, [targetMediaId]))
          mediaParams.set('at', auth.at)

          const maxMediaAttempts = 30
          for (let m = 0; m < maxMediaAttempts; m++) {
            if (m > 0) {
              await new Promise((resolve) => setTimeout(resolve, 3000))
            }
            const mediaText = await this.requestText(mediaBatchUrl, {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                origin: 'https://flow.google.com',
                'x-same-domain': '1',
                cookie: auth.cookieString,
                referer: profile.url
              },
              body: mediaParams.toString(),
              proxy
            })

            try {
              const mediaPayload = firstPayload(mediaText, RPC_MEDIA)
              const mediaUrls = [
                ...readMediaUrls(mediaPayload),
                ...readMediaUrls(mediaText)
              ]
              const matchedVideo = mediaUrls.find((u) => u.includes('/video/') || u.includes('.mp4'))
              if (matchedVideo) {
                videoUrl = matchedVideo
                thumbnailUrl = mediaUrls.find((u) => u.includes('/image/'))
                break
              }
            } catch (_) {}
          }

          if (videoUrl) {
            break
          }

          throw new Error(
            `Google Flow video operation ${op.operationId} completed with ${latestOp.status} but returned no video URL from ${RPC_MEDIA}`
          )
        }
      } catch (err: any) {
        if (err.message?.includes('Google Flow video operation')) throw err
        // Continue polling if transient network tick
      }
    }

    if (!videoUrl) {
      throw new Error(`Google Flow video generation timed out or failed for operation ${op.operationId}`)
    }

    return {
      url: videoUrl,
      thumbnailUrl,
      refId: op.operationId,
      seed: payload.seed ?? 0,
      prompt: payload.prompt,
      metadata: {
        providerId: 'FLOW_GOOGLE',
        projectId: auth.projectId,
        operationId: op.operationId
      }
    }
  }
}
