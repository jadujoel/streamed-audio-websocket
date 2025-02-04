export function canStart(): Promise<void> {
  return new Promise<void>((resolve => {
    interface NavigatorWithAutoplayPolicy extends Navigator {
      getAutoplayPolicy: (type: "audiocontext") => "allowed" | "disallowed"
    }
    function isNavigatorWithAutoPlayPolicy(navigator: Navigator): navigator is NavigatorWithAutoplayPolicy {
      return (navigator as NavigatorWithAutoplayPolicy).getAutoplayPolicy !== undefined
    }
    const hasPolicy = isNavigatorWithAutoPlayPolicy(navigator)
    function check() {
      if (isNavigatorWithAutoPlayPolicy(navigator)) {
        if (navigator.getAutoplayPolicy("audiocontext") === "allowed") {
          return true
        }
      } else if (navigator.userActivation.isActive) {
        return true
      } else if (navigator.userActivation.hasBeenActive) {
        const context = new AudioContext()
        if (context.state === "running") {
          resolve()
        }
        context.close().catch()
      }
      return false
    }
    if (check()) {
      resolve()
      return
    // no need to try to start even once the audio context on firefox
    } else if (!hasPolicy) {
      if (navigator.userActivation.isActive) {
        resolve()
        return
      }
      try {
        const context = new AudioContext()
        if (context.state === "running") {
          resolve()
        }
        context.close().catch(console.warn)
      } catch (e) {
        console.warn(e)
      }
    }
    const ptr = globalThis.setInterval(() => {
      if (check()) {
        clearInterval(ptr)
        resolve()
      }
    }, 200)
  }))
}
