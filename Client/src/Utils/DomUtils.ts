import { flow } from 'lodash';
import { preorder } from 'wdk-client/Utils/TreeUtils';
import { find } from 'wdk-client/Utils/IterableUtils';

export function findAncestorNode(
  targetNode: Node | null,
  predicate: (node: Node) => boolean,
  rootNode: Node = document
): Node | undefined {
  if (targetNode == null || targetNode == rootNode) return undefined;

  return predicate(targetNode)
    ? targetNode
    : findAncestorNode(targetNode.parentNode, predicate, rootNode);
}

/**
 * Check if a targetNode has an ancestor node that satisfies a predicate function.
 */
export function containsAncestorNode(
  targetNode: Node | null,
  predicate: (node: Node) => boolean,
  rootNode: Node = document
): boolean {
  const ancestorNode = findAncestorNode(targetNode, predicate, rootNode);
  return ancestorNode != null;
}

/**
 * Track scroll position of `element` and if height or width of `element`
 * changes, scroll to tracked position.
 */
export const addScrollAnchor = addScrollAnchor__loop

/*
 * Loop-based algorithm for scroll anchoring.
 *
 * This requires a little more work by the browser since it is a continuous
 * loop, but it allows all logic to be performed in the same callback function
 * which mitigates the potential for race conditions.
 */
function addScrollAnchor__loop(
  container: Element,
  anchorNode = findAnchorNode(container)
) {
  let { scrollY } = window;
  let containerRect = container.getBoundingClientRect();
  let animId: number;

  function loop() {
    animId = requestAnimationFrame(function() {
      loop();
      if (containerHasResized()) {
        scrollToAnchor();
      }
      else if (pageHasScrolled()) {
        updateAnchor();
      }
      scrollY = window.scrollY;
      containerRect = container.getBoundingClientRect();
    });
  }

  function pageHasScrolled(): boolean {
    return scrollY !== window.scrollY;
  }

  function updateAnchor() {
    anchorNode = findAnchorNode(container);
    console.debug('updating anchorNode', anchorNode);
  }

  function containerHasResized(): boolean {
    const newContainerRect = container.getBoundingClientRect();
    const heightDiff = Math.abs(containerRect.height - newContainerRect.height);
    const widthDiff = Math.abs(containerRect.width - newContainerRect.width);
    if (heightDiff > 10 || widthDiff > 10) {
      console.debug({ heightDiff, widthDiff });
      return true;
    }
    return false;
  }

  function scrollToAnchor() {
    if (anchorNode != null) {
      anchorNode.scrollIntoView();
      console.debug('scrolling to anchorNode', anchorNode);
    }
  }

  // start loop
  loop();

  return function cancel() {
    cancelAnimationFrame(animId);
  }
}


/**
 * Event-based algorithm for scroll anchoring.
 */
function addScrollAnchor__events(element: Element, anchorNode = findAnchorNode(element)) {
  let anchorNodeRect = anchorNode && anchorNode.getBoundingClientRect();
  let scrollingToAnchor = false;

  console.debug(Date.now(), 'updated anchorNode', anchorNode);

  function scrollHandler() {
    if (scrollingToAnchor) return;

    anchorNode = findAnchorNode(element);
    anchorNodeRect = anchorNode && anchorNode.getBoundingClientRect();
    console.debug(Date.now(), 'updated anchorNode', anchorNode);
  }

  function rectHandler() {
    if (anchorNode == null || anchorNodeRect == null) return;

    scrollingToAnchor = true;
    anchorNode.scrollIntoView();
    window.scrollBy(0, (anchorNodeRect.top * -1) + 1);
    console.debug(Date.now(), 'scrolled to anchorNode', anchorNode);
    setTimeout(() => { scrollingToAnchor = false });
  }

  // return composite cancellation function
  return flow(
    monitorRectChange(element, ['height', 'width'], rectHandler),
    monitorScroll(scrollHandler)
  );
}

/**
 * When properties of the client rectangle of `element` change, invoke callback.
 */
function monitorRectChange(element: Element, trackedProps: Array<keyof ClientRect>, callback: () => void) {
  // FIXME Don't monitor while user is scrolling
  let rect = element.getBoundingClientRect();
  let rafId: number;

  checkWidth();

  return function cancel() {
    cancelAnimationFrame(rafId);
  }

  function checkWidth() {
    rafId = requestAnimationFrame(function() {
      checkWidth();
      let newRect = element.getBoundingClientRect();
      if (trackedProps.some(prop => rect[prop] !== newRect[prop])) {
        callback();
      }
      rect = newRect;
    });
  }
}

/**
 * Invoke callback when window scroll event is fired.
 */
function monitorScroll(scrollHandler: () => void) {
  window.addEventListener('scroll', scrollHandler);
  return function cancel() {
    window.removeEventListener('scroll', scrollHandler);
  }
}

/**
 * Find first descendent of `element` that is within viewport.
 */
function findAnchorNode(element: Element) {
  // skip if element is below top of viewport
  if (element.getBoundingClientRect().top > 0) return;

  return find(
    (node: Element) => node.getBoundingClientRect().top > 0,
    preorder(element, getElementChildren)
  );
}

function getElementChildren(el: Element) {
  return Array.from(el.children);
}

/**
 * Scroll element into view, if needed. Only scrolls offsetParent.
 * @param element Element to scroll into view
 */
export function scrollIntoViewIfNeeded(element: HTMLElement) {
  const { offsetParent } = element;
  const scrollParent = findAncestorNode(
    element,
    node => {
      if (!(node instanceof HTMLElement)) return false;
      const { overflowY } = window.getComputedStyle(node);
      const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';
      return isScrollable && node.scrollHeight >= node.clientHeight;
    }
  )
  if (
    offsetParent != null &&
    scrollParent instanceof HTMLElement &&
    // below the bottom
    ((offsetParent.scrollTop > element.offsetTop) ||
    (offsetParent.clientHeight + offsetParent.scrollTop) <= (element.offsetTop + element.clientHeight))
    // above the top
  ) {
    scrollParent.scrollTop = element.offsetTop;
  }
}