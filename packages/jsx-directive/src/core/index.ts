import {
  babelParse,
  generateTransform,
  getLang,
  MagicStringAST,
  walkAST,
  type CodeTransform,
} from '@vue-macros/common'
import { transformVFor } from './v-for'
import { transformVHtml } from './v-html'
import { transformVIf } from './v-if'
import { transformVMemo } from './v-memo'
import { transformVModel } from './v-model'
import { transformOnWithModifiers, transformVOn } from './v-on'
import { transformVSlot, type VSlotMap } from './v-slot'
import type { JSXAttribute, JSXElement, Node } from '@babel/types'

export type JsxDirective = {
  node: JSXElement
  attribute: JSXAttribute
  parent?: Node | null
  vForAttribute?: JSXAttribute
  vMemoAttribute?: JSXAttribute
}

const onWithModifiersRegex = /^on[A-Z]\S*_\S+/

export function transformJsxDirective(
  code: string,
  id: string,
  version: number,
  prefix = 'v-',
): CodeTransform | undefined {
  const lang = getLang(id)
  if (!['jsx', 'tsx'].includes(lang)) return

  const s = new MagicStringAST(code)
  const vIfMap = new Map<Node | null | undefined, JsxDirective[]>()
  const vForNodes: JsxDirective[] = []
  const vMemoNodes: (JsxDirective & {
    vForAttribute?: JSXAttribute
  })[] = []
  const vHtmlNodes: JsxDirective[] = []
  const vSlotMap: VSlotMap = new Map()
  const vOnNodes: JsxDirective[] = []
  const onWithModifiers: JsxDirective[] = []
  walkAST<Node>(babelParse(code, lang), {
    enter(node, parent) {
      if (node.type !== 'JSXElement') return
      const tagName = s.sliceNode(node.openingElement.name)

      let vIfAttribute
      let vForAttribute
      let vMemoAttribute
      let vSlotAttribute
      for (const attribute of node.openingElement.attributes) {
        if (attribute.type !== 'JSXAttribute') continue

        if (
          [`${prefix}if`, `${prefix}else-if`, `${prefix}else`].includes(
            String(attribute.name.name),
          )
        ) {
          vIfAttribute = attribute
        } else if (attribute.name.name === `${prefix}for`) {
          vForAttribute = attribute
        } else if (
          [`${prefix}memo`, `${prefix}once`].includes(
            String(attribute.name.name),
          )
        ) {
          vMemoAttribute = attribute
        } else if (attribute.name.name === `${prefix}html`) {
          vHtmlNodes.push({
            node,
            attribute,
          })
        } else if (
          (attribute.name.type === 'JSXNamespacedName'
            ? attribute.name.namespace
            : attribute.name
          ).name === `${prefix}slot`
        ) {
          vSlotAttribute = attribute
        } else if (attribute.name.name === `${prefix}on`) {
          vOnNodes.push({
            node,
            attribute,
          })
        } else if (onWithModifiersRegex.test(String(attribute.name.name))) {
          onWithModifiers.push({
            node,
            attribute,
          })
        } else if (
          attribute.name.type === 'JSXNamespacedName' &&
          attribute.name.namespace.name === `${prefix}model`
        ) {
          transformVModel(attribute, s, version)
        }
      }

      if (!(vSlotAttribute && tagName === 'template')) {
        if (vIfAttribute) {
          vIfMap.get(parent) || vIfMap.set(parent, [])
          vIfMap.get(parent)!.push({
            node,
            attribute: vIfAttribute,
            parent,
          })
        }

        if (vForAttribute) {
          vForNodes.push({
            node,
            attribute: vForAttribute,
            parent: vIfAttribute ? undefined : parent,
            vMemoAttribute,
          })
        }
      }

      if (vMemoAttribute) {
        vMemoNodes.push({
          node,
          attribute: vMemoAttribute,
          parent: vForAttribute || vIfAttribute ? undefined : parent,
          vForAttribute,
        })
      }

      if (vSlotAttribute) {
        const slotNode = tagName === 'template' ? parent : node
        if (slotNode?.type !== 'JSXElement') return

        const attributeMap =
          vSlotMap.get(slotNode)?.attributeMap ||
          vSlotMap
            .set(slotNode, {
              vSlotAttribute:
                tagName !== 'template' ? vSlotAttribute : undefined,
              attributeMap: new Map(),
            })
            .get(slotNode)!.attributeMap
        const children =
          attributeMap.get(vSlotAttribute)?.children ||
          attributeMap
            .set(vSlotAttribute, {
              children: [],
              ...(tagName === 'template'
                ? {
                    vIfAttribute,
                    vForAttribute,
                  }
                : {}),
            })
            .get(vSlotAttribute)!.children

        if (slotNode === parent) {
          children.push(node)

          if (attributeMap.get(null)) return
          for (const child of parent.children) {
            if (
              (child.type === 'JSXElement' &&
                s.sliceNode(child.openingElement.name) === 'template') ||
              (child.type === 'JSXText' && !s.sliceNode(child).trim())
            )
              continue
            const defaultNodes =
              attributeMap.get(null)?.children ||
              attributeMap.set(null, { children: [] }).get(null)!.children
            defaultNodes.push(child)
          }
        } else {
          children.push(...node.children)
        }
      }
    },
  })

  vIfMap.forEach((nodes) => transformVIf(nodes, s, version, prefix))
  transformVFor(vForNodes, s, version)
  if (!version || version >= 3.2) transformVMemo(vMemoNodes, s, version)
  transformVHtml(vHtmlNodes, s, version)
  transformVOn(vOnNodes, s, version)
  transformOnWithModifiers(onWithModifiers, s, version, prefix)
  transformVSlot(vSlotMap, s, version, prefix)

  return generateTransform(s, id)
}

export function isVue2(version: number): boolean {
  return version >= 2 && version < 3
}
