// jest-dom's own `declare module 'vitest'` augments whichever vitest copy jest-dom itself
// resolves, and pnpm can peer-resolve that to a different variant than this package's (any
// optional vitest peer elsewhere in the workspace, such as @opentelemetry/api, splits it).
// Declaring the augmentation here anchors it to this package's vitest.
import 'vitest'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
