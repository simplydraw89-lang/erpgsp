// These extension-owned markers are absent from the server HTML. Remove only
// these known markers; preserve application attributes and real hydration errors.
export function isExtensionAttribute(name: string) {
  return name === "bis_skin_checked" || name === "bis_register" ||
    /^__processed_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}__$/i.test(name)
}

export function removeExtensionAttributes(element: Element) {
  for (const name of element.getAttributeNames()) {
    if (isExtensionAttribute(name)) element.removeAttribute(name)
  }
}

export function cleanExtensionTree(root: Element) {
  removeExtensionAttributes(root)
  for (const element of root.querySelectorAll("*")) {
    removeExtensionAttributes(element)
  }
}

export function protectHydrationFromExtensionAttributes() {
  cleanExtensionTree(document.documentElement)

  // Also cover streamed HTML and markers injected after the initial cleanup.
  // Inspect only changed attributes/subtrees, never rescan the whole document.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (mutation.attributeName && isExtensionAttribute(mutation.attributeName)) {
          removeExtensionAttributes(mutation.target as Element)
        }
      } else {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) cleanExtensionTree(node)
        }
      }
    }
  })
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  })
  return observer
}
