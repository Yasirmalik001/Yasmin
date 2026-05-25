/* ==========================================================================
   App JS - Custom theme scripts
   ========================================================================== */

/* --------------------------------------------------------------------------
   Custom Pagination - Load More & Infinite Scroll
   -------------------------------------------------------------------------- */
if (!customElements.get('custom-pagination')) {
    customElements.define(
        'custom-pagination',
        class extends HTMLElement {
            constructor() {
                super();
                this.type = this.getAttribute('data-type');
                this.url = this.getAttribute('data-url');
                this.isLoading = false;

                if (!this.url) return;

                if (this.type === 'load_more') {
                    this.button = this.querySelector('button');
                    if (this.button) {
                        this.button.addEventListener('click', this.loadNextPage.bind(this));
                    }
                } else if (this.type === 'infinite') {
                    this.observer = new IntersectionObserver(this.handleScroll.bind(this), {
                        rootMargin: '0px 0px 600px 0px',
                        threshold: 0.1,
                    });
                }
            }

            connectedCallback() {
                if (this.type === 'infinite' && this.url) {
                    this.observer.observe(this);
                }
            }

            disconnectedCallback() {
                if (this.observer) this.observer.disconnect();
            }

            handleScroll(entries) {
                const entry = entries[0];
                if (entry.isIntersecting && !this.isLoading) {
                    this.loadNextPage();
                }
            }

            loadNextPage(event) {
                if (event) event.preventDefault();
                if (!this.url || this.isLoading) return;

                this.isLoading = true;

                // Update UI to loading state
                if (this.type === 'load_more' && this.button) {
                    this.button.classList.add('loading');
                    this.button.setAttribute('aria-disabled', 'true');
                    const spinner = this.button.querySelector('.loading__spinner');
                    if (spinner) spinner.classList.remove('hidden');
                } else if (this.type === 'infinite') {
                    const indicator = this.querySelector('.loading-indicator');
                    if (indicator) indicator.style.display = 'flex';
                }

                fetch(this.url)
                    .then((response) => response.text())
                    .then((html) => {
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const newProducts = doc.querySelectorAll('#product-grid .grid__item');
                        const currentGrid = document.querySelector('#product-grid');

                        if (currentGrid && newProducts.length > 0) {
                            newProducts.forEach((product) => currentGrid.appendChild(product));
                        }

                        const newPagination = doc.querySelector('custom-pagination');
                        if (newPagination) {
                            if (this.observer) this.observer.disconnect();
                            this.replaceWith(newPagination);
                        } else {
                            this.remove();
                        }
                    })
                    .catch((error) => {
                        console.error('Error fetching products:', error);
                        this.isLoading = false;
                        if (this.button) {
                            this.button.classList.remove('loading');
                            this.button.removeAttribute('aria-disabled');
                            const spinner = this.button.querySelector('.loading__spinner');
                            if (spinner) spinner.classList.add('hidden');
                        }
                    });
            }
        }
    );
}


/* --------------------------------------------------------------------------
   Slider Container
   -------------------------------------------------------------------------- */
if (!customElements.get('slider-container')) {
    class SliderContainer extends HTMLElement {
        constructor() {
            super();
            this.swiperInstance = null;
            this._onMediaChange = this._onMediaChange.bind(this);
            this._onVisibility = this._onVisibility.bind(this);
            this._rafId = null;
        }

        connectedCallback() {
            this._rafId = requestAnimationFrame(() => this._setup());
        }

        disconnectedCallback() {
            if (this._rafId) cancelAnimationFrame(this._rafId);
            this._teardownMedia();
            this._teardownVisibility();
            this._destroySlider();
        }

        _setup() {
            this.swiperEl = this.querySelector('.js-slider-template-swiper');
            if (!this.swiperEl) return;

            this.config = this._parseConfig(this.swiperEl);
            if (!this.config) return;

            this._progressFill = this.querySelector('.slider-template-progress-fill');
            this._paginationEl = this.querySelector('.slider-template-pagination');
            this._prevBtn = document.querySelector(`#collection-${this.dataset.blockId} .js-slider-template-prev`);
            this._nextBtn = document.querySelector(`#collection-${this.dataset.blockId} .js-slider-template-next`);

            this._mql = window.matchMedia('(max-width: 749px)');
            this._mql.addEventListener('change', this._onMediaChange);
            this._onMediaChange(this._mql);

            if (this.config.autoplay) {
                this._observer = new IntersectionObserver(this._onVisibility, { threshold: 0.25 });
                this._observer.observe(this);
            }
        }

        _onMediaChange(e) {
            const isMobile = e.matches;
            const shouldEnable = isMobile
                ? this.config.enableSliderMobile
                : this.config.enableSliderDesktop;

            if (shouldEnable) {
                this.classList.remove('slider-disabled');
                this._initSlider();
            } else {
                this._destroySlider();
                this.classList.add('slider-disabled');
            }
        }

        _onVisibility(entries) {
            if (!this.swiperInstance || !this.swiperInstance.autoplay) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.swiperInstance.autoplay.start();
                } else {
                    this.swiperInstance.autoplay.stop();
                }
            });
        }

        _teardownMedia() {
            if (this._mql) {
                this._mql.removeEventListener('change', this._onMediaChange);
                this._mql = null;
            }
        }

        _teardownVisibility() {
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
        }

        _initSlider() {
            if (this.swiperInstance) return;

            const swiperParams = {
                slidesPerView: this.config.mobileSlides,
                spaceBetween: this.config.mobileSpacing,
                loop: this.config.loop || false,
                grabCursor: true,
                observer: true,
                observeParents: true,
                watchSlidesProgress: true,
                lazyPreloadPrevNext: 2,
                mousewheel: { forceToAxis: true },
                breakpoints: {
                    750: {
                        slidesPerView: this.config.desktopSlides,
                        spaceBetween: this.config.desktopSpacing,
                    },
                },
                on: {
                    init: (swiper) => {
                        this.classList.add('is-initialized');
                        this._updateProgress(swiper);
                    },
                    progress: (swiper) => this._updateProgress(swiper),
                    slideChange: (swiper) => this._updateProgress(swiper),
                    resize: (swiper) => this._updateProgress(swiper),
                },
            };

            if (this._paginationEl) {
                swiperParams.pagination = {
                    el: this._paginationEl,
                    type: 'bullets',
                    clickable: true,
                    dynamicBullets: this.config.desktopSlides > 5,
                };
            }

            if (this._prevBtn && this._nextBtn) {
                swiperParams.navigation = {
                    nextEl: this._nextBtn,
                    prevEl: this._prevBtn,
                };
            }

            if (this.config.autoplay) {
                swiperParams.autoplay = {
                    delay: this.config.autoplayInterval,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                };
            }

            try {
                this.swiperInstance = new Swiper(this.swiperEl, swiperParams);
            } catch (err) {
                console.warn('[slider-container] Swiper init failed:', err);
            }
        }

        _destroySlider() {
            if (!this.swiperInstance) return;

            this.swiperInstance.destroy(true, true);
            this.swiperInstance = null;
            this.classList.remove('is-initialized');

            const wrapper = this.swiperEl?.querySelector('.swiper-wrapper');
            if (wrapper) wrapper.removeAttribute('style');

            this.querySelectorAll('.swiper-slide').forEach((slide) => {
                slide.removeAttribute('style');
            });
        }

        _updateProgress(swiper) {
            if (!this._progressFill) return;
            const total = swiper.slides.length - swiper.params.slidesPerView;
            if (total <= 0) {
                this._progressFill.style.width = '100%';
                return;
            }
            const pct = Math.min(100, (swiper.realIndex / total) * 100);
            this._progressFill.style.width = `${pct}%`;
        }

        _parseConfig(el) {
            try {
                return JSON.parse(el.dataset.swiperConfig || '{}');
            } catch {
                console.warn('[slider-container] Invalid data-swiper-config JSON.');
                return null;
            }
        }
    }

    customElements.define('slider-container', SliderContainer);
}

// Ensure sliders work correctly when navigating back/forward (BFCache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        requestAnimationFrame(() => {
            document.querySelectorAll('slider-container').forEach((slider) => {
                if (slider.swiperInstance) {
                    slider.swiperInstance.update();
                } else if (slider.config && typeof Swiper !== 'undefined') {
                    slider._initSlider();
                }
            });
        });
    }
});