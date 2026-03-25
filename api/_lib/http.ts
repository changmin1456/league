import type { IncomingMessage, ServerResponse } from 'node:http'

export type ApiRequest = IncomingMessage & {
  body?: unknown
}

export const json = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export const readJsonBody = async (req: ApiRequest): Promise<unknown> => {
  if (typeof req.body !== 'undefined') {
    return req.body
  }
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export const parseUrl = (req: ApiRequest) => new URL(req.url ?? '/', 'http://localhost')
