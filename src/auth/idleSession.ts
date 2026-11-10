/** CRM web session: sign out after this long with no user activity. */
export const CRM_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const
const MARK_GAP_MS = 30_000

/**
 * Calls `onIdle` once when the signed-in CRM user has not used the page for
 * `timeoutMs`. Pointer, key, and scroll activity restarts the window. A tab
 * that was suspended still signs out when it becomes visible after the window.
 */
export function watchCrmIdle(onIdle: () => void, timeoutMs = CRM_IDLE_TIMEOUT_MS): () => void {
  let last = Date.now()
  let fired = false
  let timer = 0

  const fire = () => {
    if (fired) return
    fired = true
    window.clearTimeout(timer)
    onIdle()
  }

  const arm = (ms: number) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(fire, ms)
  }

  const mark = () => {
    if (fired) return
    const now = Date.now()
    if (now - last < MARK_GAP_MS) return
    last = now
    arm(timeoutMs)
  }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    const idleFor = Date.now() - last
    if (idleFor >= timeoutMs) fire()
    else arm(timeoutMs - idleFor)
  }

  arm(timeoutMs)
  for (const name of ACTIVITY_EVENTS) {
    window.addEventListener(name, mark, { passive: true })
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    fired = true
    window.clearTimeout(timer)
    for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
