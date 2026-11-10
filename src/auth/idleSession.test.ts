import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CRM_IDLE_TIMEOUT_MS, watchCrmIdle } from './idleSession'

describe('watchCrmIdle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('signs out after 2 hours with no activity', () => {
    const onIdle = vi.fn()
    const stop = watchCrmIdle(onIdle)
    vi.advanceTimersByTime(CRM_IDLE_TIMEOUT_MS - 1)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledOnce()
    stop()
  })

  it('restarts the 2 hour window when the user is active', () => {
    const onIdle = vi.fn()
    const stop = watchCrmIdle(onIdle)
    vi.advanceTimersByTime(31_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(CRM_IDLE_TIMEOUT_MS - 1)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledOnce()
    stop()
  })

  it('signs out when a suspended tab becomes visible after 2 idle hours', () => {
    const onIdle = vi.fn()
    const stop = watchCrmIdle(onIdle)
    vi.setSystemTime(Date.now() + CRM_IDLE_TIMEOUT_MS)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onIdle).toHaveBeenCalledOnce()
    stop()
  })

  it('does not sign out after the watcher is stopped', () => {
    const onIdle = vi.fn()
    const stop = watchCrmIdle(onIdle)
    stop()
    vi.advanceTimersByTime(CRM_IDLE_TIMEOUT_MS)
    expect(onIdle).not.toHaveBeenCalled()
  })
})
