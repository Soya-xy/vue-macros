import { DEFINE_OPTIONS, isCallOf } from '@vue-macros/common'
import type { SFCScriptBlock } from '@vue/compiler-sfc'
import type { CallExpression, Node, ObjectExpression } from '@babel/types'

export const filterMarco = (scriptSetup: SFCScriptBlock) => {
  return scriptSetup
    .scriptSetupAst!.map((raw: Node) => {
      let node = raw
      if (raw.type === 'ExpressionStatement') node = raw.expression
      return isCallOf(node, DEFINE_OPTIONS) ? node : undefined
    })
    .filter((node): node is CallExpression => !!node)
}

export const hasPropsOrEmits = (node: ObjectExpression) =>
  node.properties.some(
    (prop) =>
      (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') &&
      prop.key.type === 'Identifier' &&
      (prop.key.name === 'props' || prop.key.name === 'emits')
  )