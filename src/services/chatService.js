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
  },
  sendRagMessage(message) {
    return post('/chat', { message }, { timeoutMs: 180000 })
  },
  runAgent(prompt) {
    return post('/admin/agent', { prompt }, { timeoutMs: 180000 })
  },
  reportClientError(description) {
    return post('/ai/bug-reports', { description }, { timeoutMs: 15000 })
  }
}
