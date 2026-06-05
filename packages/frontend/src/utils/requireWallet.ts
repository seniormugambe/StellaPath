import { store } from '../store'

// Dispatch a global event to open the wallet connect dialog and wait for connection
export async function requireWallet(timeoutMs = 120000): Promise<void> {
  const state = store.getState()
  if (state.wallet.connected) return

  // Fire event to request the wallet dialog open (WalletButton listens)
  window.dispatchEvent(new CustomEvent('stellarpath:wallet:open'))

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = store.subscribe(() => {
      const s = store.getState()
      if (s.wallet.connected) {
        if (timer) clearTimeout(timer)
        unsubscribe()
        resolve()
      }
    })

    timer = setTimeout(() => {
      try { unsubscribe() } catch {}
      reject(new Error('Wallet connection timed out'))
    }, timeoutMs)
  })
}

export default requireWallet
