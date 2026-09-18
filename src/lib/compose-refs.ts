import * as React from 'react'

type PossibleRef<T> = React.Ref<T> | undefined

/**
 * Gán giá trị node vào ref (hỗ trợ function callback và RefObject)
 */
function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    return ref(value)
  } else if (ref !== null && ref !== undefined) {
    ;(ref as React.MutableRefObject<T>).current = value
  }
}

/**
 * Kết hợp nhiều ref thành một ref duy nhất tương thích React 19
 */
function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  return (node) => {
    let hasCleanup = false
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node)
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true
      }
      return cleanup
    })

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i]
          if (typeof cleanup === 'function') {
            cleanup()
          }
        }
      }
    }
  }
}

/**
 * Hook kết hợp refs ổn định danh tính trong React 19 để tránh vòng lặp re-render vô tận
 * ("Maximum update depth exceeded" trong Radix Presence / Slot)
 */
function useComposedRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  const refsRef = React.useRef(refs)
  refsRef.current = refs

  return React.useCallback((node: T) => {
    let hasCleanup = false
    const cleanups = refsRef.current.map((ref) => {
      const cleanup = setRef(ref, node)
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true
      }
      return cleanup
    })

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i]
          if (typeof cleanup === 'function') {
            cleanup()
          }
        }
      }
    }
  }, [])
}

export { composeRefs, useComposedRefs }
export default composeRefs
