import { post } from './httpClient'

export const chatService = {
  sendMessage({ mensaje, conversacionId }) {
    return post(
      '/ai/chat',
      {
        mensaje,
        ...(conversacionId ? { conversacionId } : {})
      },
      { timeoutMs: 180000 }
    )
  }
}