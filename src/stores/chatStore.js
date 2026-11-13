import { ref } from 'vue'

const createEmptyChat = () => ({
  id: null,
  turns: [],
  pending: false,
  draft: '',
  error: ''
})

export const chatState = ref(createEmptyChat())

export function resetChat() {
  chatState.value = createEmptyChat()
}