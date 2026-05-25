const SCROLL_ANIMATION_TRIGGER_CLASSNAME = 'scroll-trigger';
const SCROLL_ANIMATION_OFFSCREEN_CLASSNAME = 'scroll-trigger--offscreen';
const SCROLL_ZOOM_IN_TRIGGER_CLASSNAME = 'animate--zoom-in';
const SCROLL_ANIMATION_CANCEL_CLASSNAME = 'scroll-trigger--cancel';

// Local utility: Throttle function
function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return fn.apply(this, args);
  };
}

// Scroll initialization with shared observer
const globalIntersectionObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    const target = entry.target;
    if (entry.isIntersecting) {
      if (target.classList.contains(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME)) {
        target.classList.remove(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
        if (target.hasAttribute('data-cascade')) {
          const index = Array.from(target.parentNode.children).indexOf(target);
          target.setAttribute('style', `--animation-order: ${index};`);
        }
      }
      observer.unobserve(target);
    } else {
      target.classList.add(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
      target.classList.remove(SCROLL_ANIMATION_CANCEL_CLASSNAME);
    }
  });
}, { rootMargin: '0px 0px -100px 0px' });

function initializeScrollAnimationTrigger(rootEl = document, isDesignModeEvent = false) {
  const elements = Array.from(rootEl.getElementsByClassName(SCROLL_ANIMATION_TRIGGER_CLASSNAME));
  if (elements.length === 0) return;

  if (isDesignModeEvent) {
    elements.forEach(el => el.classList.add('scroll-trigger--design-mode'));
    return;
  }

  elements.forEach(el => globalIntersectionObserver.observe(el));
}

// Optimized Zoom in animation logic
function initializeScrollZoomAnimationTrigger() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const elements = Array.from(document.getElementsByClassName(SCROLL_ZOOM_IN_TRIGGER_CLASSNAME));
  if (elements.length === 0) return;

  const scaleAmount = 0.2 / 100;

  elements.forEach((element) => {
    let isVisible = false;
    let cachedRect = null;
    let ticking = false;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          cachedRect = {
            top: entry.boundingClientRect.top + window.scrollY,
            height: entry.boundingClientRect.height
          };
        }
      });
    }, { threshold: [0, 0.1, 0.5, 1] });

    observer.observe(element);

    const updateZoom = () => {
      if (!isVisible || !cachedRect) { ticking = false; return; }

      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const elementPositionY = cachedRect.top;
      const elementHeight = cachedRect.height;

      let percentage = 0;
      if (elementPositionY <= scrollY + viewportHeight && elementPositionY + elementHeight >= scrollY) {
        const distance = scrollY + viewportHeight - elementPositionY;
        percentage = distance / ((viewportHeight + elementHeight) / 100);
      } else if (elementPositionY + elementHeight < scrollY) {
        percentage = 100;
      }

      element.style.setProperty('--zoom-in-ratio', 1 + scaleAmount * Math.round(percentage));
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!isVisible || ticking) return;
      ticking = true;
      requestAnimationFrame(updateZoom);
    }, { passive: true });

    requestAnimationFrame(updateZoom);
  });
}

function initializeAutoSectionAnimations() {
  const sections = document.querySelectorAll('section, .shopify-section > div');
  sections.forEach((section, index) => {
    // Skip heroes that should be visible instantly
    if (index === 0 || section.hasAttribute('data-priority-hero') || section.closest('[data-priority-hero]')) return;

    if (!section.classList.contains('scroll-trigger') && !section.closest('.header-wrapper')) {
      section.classList.add('scroll-trigger', 'animate--slide-in');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initializeAutoSectionAnimations();
  initializeScrollAnimationTrigger();
  initializeScrollZoomAnimationTrigger();
});

if (Shopify.designMode) {
  document.addEventListener('shopify:section:load', (event) => {
    initializeAutoSectionAnimations();
    initializeScrollAnimationTrigger(event.target, true);
  });
  document.addEventListener('shopify:section:reorder', () => {
    initializeAutoSectionAnimations();
    initializeScrollAnimationTrigger(document, true);
  });
}
