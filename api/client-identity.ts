import { createHash } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { json, parseUrl, type ApiRequest } from './_lib/http.js'

const readClientIp = (req: ApiRequest) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim() !== '') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim() !== '') return realIp.trim()
  const cfIp = req.headers['cf-connecting-ip']
  if (typeof cfIp === 'string' && cfIp.trim() !== '') return cfIp.trim()
  return 'unknown'
}

export default function handler(req: ApiRequest, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
      return
    }

    const url = parseUrl(req)
    const userLabel = (url.searchParams.get('userLabel') ?? '').trim().toLowerCase()
    if (!userLabel) {
      json(res, 400, { error: 'userLabel이 필요합니다.' })
      return
    }

    const ip = readClientIp(req)
    const raw = `${ip}|${userLabel}`
    const key = createHash('sha256').update(raw).digest('hex').slice(0, 32)
    json(res, 200, { key })
  } catch (error) {
    const message = error instanceof Error ? error.message : '클라이언트 식별값 생성 실패'
    json(res, 500, { error: message })
  }
}
