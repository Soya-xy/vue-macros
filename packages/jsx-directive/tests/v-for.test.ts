import { testFixtures } from '@vue-macros/test-utils'
import { describe } from 'vitest'
import { transformJsxDirective } from '../src/api'

describe('jsx-vue-directive', () => {
  describe('vue 2.7 v-for', async () => {
    await testFixtures(
      import.meta.glob<string>('./fixtures/v-for/*.{vue,jsx,tsx}', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
      (_, id, code) => transformJsxDirective(code, id, 2.7)?.code,
    )
  })

  describe('vue 3 v-for', async () => {
    await testFixtures(
      import.meta.glob<string>('./fixtures/v-for/*.{vue,jsx,tsx}', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
      (_, id, code) => transformJsxDirective(code, id, 3)?.code,
    )
  })
})
