class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.addEventListener('click', (event) => {
      if (event.target.id === 'CartDrawer-Overlay') this.close();
    });
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    // Sync is-empty class from the new section HTML
    if (parsedState.sections && parsedState.sections['cart-drawer']) {
      const sectionDOM = new DOMParser().parseFromString(parsedState.sections['cart-drawer'], 'text/html');
      const cartDrawerElement = sectionDOM.querySelector('cart-drawer');
      if (cartDrawerElement) {
        this.classList.toggle('is-empty', cartDrawerElement.classList.contains('is-empty'));
      }
    }

    setTimeout(() => {
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);

function formatMoney(amount, locale, currency) {
  const loc = locale || 'en-US';
  const curr = currency || 'USD';

  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

if (!customElements.get('free-shipping')) {
  class FreeShipping extends HTMLElement {
    constructor() {
      super();
      this.giftAdded = false;
      this.processingGift = false;
      this.locale = 'en-US';
      this.currency = 'USD';
      this.fixedIcons = false;
    }

    connectedCallback() {
      let total = parseInt(this.dataset.cartTotal, 10);
      let showGift = this.dataset.showGift === 'true';
      let showShipping = this.dataset.showShipping === 'true';
      this.fixedIcons = this.dataset.fixedIcons === 'true';

      this.locale = this.dataset.locale;
      this.currency = this.dataset.currency;

      let shippingMinimum = Math.round(parseInt(this.dataset.minimum, 10) * (Shopify.currency.rate || 1));
      let giftMinimum = this.dataset.giftMinimum ? Math.round(parseInt(this.dataset.giftMinimum, 10) * (Shopify.currency.rate || 1)) : 0;
      let giftVariantId = this.dataset.giftVariantId;

      let activeGoals = [];

      if (showShipping) {
        activeGoals.push({
          type: 'shipping',
          value: shippingMinimum
        });
      }
      if (showGift && giftMinimum > 0) {
        activeGoals.push({
          type: 'gift',
          value: giftMinimum
        });
      }

      activeGoals.sort((a, b) => a.value - b.value);

      let maxThreshold = activeGoals.length > 0 ? activeGoals[activeGoals.length - 1].value : shippingMinimum;

      let percentage = this.calculateBarPercentage(total, activeGoals, maxThreshold);
      this.style.setProperty('--percentage', percentage);

      this.updateIcons(activeGoals, maxThreshold, total);

      let nextGoal = null;

      for (let goal of activeGoals) {
        if (total < goal.value) {
          nextGoal = goal;
          break;
        }
      }

      if (nextGoal) {
        if (nextGoal.type === 'shipping') {
          this.showShippingProgress(total, nextGoal.value);
        } else {
          this.showGiftProgress(total, nextGoal.value);
        }
      } else {
        if (activeGoals.length > 0) {
          let lastGoal = activeGoals[activeGoals.length - 1];
          if (lastGoal.type === 'shipping') {
            this.showShippingSuccess();
          } else {
            this.showGiftSuccess();
          }
        } else {
          if (showShipping) this.showShippingSuccess();
        }
      }

      if (showGift && giftMinimum > 0 && total >= giftMinimum) {
        if (giftVariantId && !this.giftAdded && !this.processingGift) {
          this.addGiftToCart(giftVariantId);
        }
      }
    }

    calculateBarPercentage(total, activeGoals, maxThreshold) {
      if (!this.fixedIcons || activeGoals.length < 2) {
        return (maxThreshold > 0) ? Math.min(total / maxThreshold, 1) : 1;
      }

      const goal1 = activeGoals[0].value;
      const goal2 = activeGoals[1].value;

      if (total < goal1) {
        return (total / goal1) * 0.5;
      } else if (total >= goal1 && total < goal2) {
        const range = goal2 - goal1;
        const progressInRange = total - goal1;
        const relativePercent = progressInRange / range;
        return 0.5 + (relativePercent * 0.5);
      } else {
        return 1;
      }
    }

    showShippingProgress(total, threshold) {
      this.hideAllTexts();
      const container = this.querySelector('.cart-drawer__progress-messages--shipping');
      const remainingText = container.querySelector('.cart-drawer__progress-text-remaining');
      const amountSpan = remainingText.querySelector('strong');

      if (container) container.classList.remove('cart-drawer__hidden');
      if (remainingText) remainingText.style.display = 'block';

      let diff = threshold - total;
      if (amountSpan) amountSpan.innerHTML = formatMoney(diff, this.locale, this.currency);

      const fullText = container.querySelector('.cart-drawer__progress-text-full');
      if (fullText) fullText.style.display = 'none';
    }

    showGiftProgress(total, threshold) {
      this.hideAllTexts();
      const container = this.querySelector('.cart-drawer__progress-messages--gift');
      const remainingText = container.querySelector('.cart-drawer__progress-text-remaining');
      const amountSpan = remainingText.querySelector('strong');

      if (container) container.classList.remove('cart-drawer__hidden');
      if (remainingText) remainingText.style.display = 'block';

      let diff = threshold - total;
      if (amountSpan) amountSpan.innerHTML = formatMoney(diff, this.locale, this.currency);

      const fullText = container.querySelector('.cart-drawer__progress-text-full');
      if (fullText) fullText.style.display = 'none';
    }

    showShippingSuccess() {
      this.hideAllTexts();
      const container = this.querySelector('.cart-drawer__progress-messages--shipping');
      const remainingText = container.querySelector('.cart-drawer__progress-text-remaining');
      const fullText = container.querySelector('.cart-drawer__progress-text-full');

      if (container) container.classList.remove('cart-drawer__hidden');
      if (remainingText) remainingText.style.display = 'none';
      if (fullText) fullText.style.display = 'block';
    }

    showGiftSuccess() {
      this.hideAllTexts();
      const container = this.querySelector('.cart-drawer__progress-messages--gift');
      const remainingText = container.querySelector('.cart-drawer__progress-text-remaining');
      const fullText = container.querySelector('.cart-drawer__progress-text-full');

      if (container) container.classList.remove('cart-drawer__hidden');
      if (remainingText) remainingText.style.display = 'none';
      if (fullText) fullText.style.display = 'block';
    }

    hideAllTexts() {
      const shipMsg = this.querySelector('.cart-drawer__progress-messages--shipping');
      const giftMsg = this.querySelector('.cart-drawer__progress-messages--gift');
      if (shipMsg) shipMsg.classList.add('cart-drawer__hidden');
      if (giftMsg) giftMsg.classList.add('cart-drawer__hidden');
    }

    updateIcons(activeGoals, maxThreshold, total) {
      const shippingIcon = this.querySelector('.cart-drawer__progress-milestone--shipping');
      const giftIcon = this.querySelector('.cart-drawer__progress-milestone--gift');

      if (shippingIcon) shippingIcon.classList.add('cart-drawer__hidden');
      if (giftIcon) giftIcon.classList.add('cart-drawer__hidden');

      activeGoals.forEach((goal, index) => {
        let icon = (goal.type === 'shipping') ? shippingIcon : giftIcon;
        if (icon) {
          icon.classList.remove('cart-drawer__hidden');
          let pos;

          if (this.fixedIcons) {
            if (activeGoals.length > 1) {
              pos = (index === 0) ? 50 : 100;
            } else {
              pos = 100;
            }
          } else {
            pos = (goal.value / maxThreshold) * 100;
          }

          icon.style.left = `${pos}%`;

          if (total >= goal.value) icon.classList.add('achieved');
          else icon.classList.remove('achieved');
        }
      });
    }

    async addGiftToCart(variantId) {
      this.processingGift = true;
      try {
        const cartResponse = await fetch('/cart.js');
        const cart = await cartResponse.json();

        const giftInCart = cart.items.some(item =>
          item.variant_id === parseInt(variantId)
        );

        if (giftInCart) {
          this.giftAdded = true;
          this.processingGift = false;
          return;
        }

        const formData = {
          items: [{
            id: variantId,
            quantity: 1
          }]
        };

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          this.giftAdded = true;
          if (typeof window.theme !== 'undefined' && window.theme.cart) window.theme.cart.refresh();
          else {
            document.dispatchEvent(new CustomEvent('cart:refresh'));
            document.dispatchEvent(new CustomEvent('theme:cartchanged'));
          }
          this.showGiftNotification();
        }
      } catch (error) {
        console.error(error);
      } finally {
        this.processingGift = false;
      }
    }

    showGiftNotification() {
      const notification = document.createElement('div');
      notification.className = 'cart-drawer__gift-notification';
      notification.setAttribute('role', 'status');
      notification.setAttribute('aria-live', 'polite');
      const notificationText = this.dataset.giftNotificationText || 'Free gift added to your cart!';
      notification.textContent = notificationText;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('show'), 100);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }
  customElements.define('free-shipping', FreeShipping);
}
