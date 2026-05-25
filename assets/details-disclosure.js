class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
    this.mainDetailsToggle.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.mainDetailsToggle.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    
    this.querySelectorAll('summary[data-url]').forEach(summary => {
      summary.addEventListener('click', this.onSummaryClick.bind(this));
    });
  }

  onSummaryClick(event) {
    const summary = event.currentTarget;
    const url = summary.dataset.url;
    if (window.innerWidth >= 990 && url && url !== '#') {
      event.preventDefault();
      window.location.href = url;
    }
  }

  onMouseEnter() {
    if (window.innerWidth >= 990) {
      this.mainDetailsToggle.setAttribute('open', '');
      this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', true);
    }
  }

  onMouseLeave() {
    if (window.innerWidth >= 990) {
      this.close();
    }
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
