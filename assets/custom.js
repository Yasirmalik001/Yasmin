class DeliveryPicker extends HTMLElement {
  static get observedAttributes() {
    return [ "delivery-date", "delivery-day", "zip-code" ];
  }

  constructor() {
    const element = super();
    this.element = element;

    // Form elements
    this.formEl = this.element.querySelector(".delivery-zone__form form");
    this.countryEl = this.formEl.querySelector("select#delivery_zone_country");
    this.zipCodeEl = this.formEl.querySelector("input#delivery_zone_zip_code");

    // Delivery zone elements
    this.deliveryZonesEl = this.element.querySelector(".delivery-zones");
    this.defaultErrorText = "";
  }

  triggerError(message) {
    const errorEl = this.querySelector(".delivery-picker__error");
    if (errorEl) {
      errorEl.textContent = message;
    }
    this.setAttribute("delivery-error", "true");
  }

  connectedCallback() {
    this.formEl.addEventListener("submit", this.#handleFormSubmission.bind(this));

    [...this.deliveryZonesEl.querySelectorAll(".delivery-zone")].forEach(deliveryZoneEl => {
      deliveryZoneEl.addEventListener("click", this.#handleDeliveryZoneSelection.bind(this));
    });

    const errorEl = this.querySelector(".delivery-picker__error");
    if (errorEl) {
      this.defaultErrorText = errorEl.textContent;
    }

    const zipCodeFromCache = localStorage.getItem("delivery-picker:zip-code");
    if (zipCodeFromCache && !this.zipCode) {
      this.zipCode = zipCodeFromCache;
      this.zipCodeEl.value = zipCodeFromCache;
    }

    if (this.deliveryDate) {
      sessionStorage.setItem("deliveryDateSelected", "true");
      window.deliveryDateSelected = true;
    } else {
      sessionStorage.setItem("deliveryDateSelected", "false");
      window.deliveryDateSelected = false;
    }

    if (this.zipCode && this.deliveryZone) {
      sessionStorage.setItem("postcodeVerified", "true");
      window.postcodeVerified = true;
    } else {
      sessionStorage.setItem("postcodeVerified", "false");
      window.postcodeVerified = false;
    }

    const today = new Date().setHours(0, 0, 0, 0);
    if (this.deliveryDate && new Date(this.deliveryDate) < today) {
      this.#clearDeliveryDate();
    }

    this.countryEl.addEventListener("change", this.#updateFlag.bind(this));
    this.#updateFlag();
  }

  disconnectedCallback() {
    this.formEl.removeEventListener("submit", this.#handleFormSubmission.bind(this));
    this.countryEl.removeEventListener("change", this.#updateFlag.bind(this));

    [...this.deliveryZonesEl.querySelectorAll(".delivery-zone")].forEach(deliveryZoneEl => {
      deliveryZoneEl.removeEventListener("click", this.#handleDeliveryZoneSelection.bind(this));
    });
  }

  updateCartAlert() {
    const verified = sessionStorage.getItem("postcodeVerified") === "true";
    const dateSelected = sessionStorage.getItem("deliveryDateSelected") === "true";
    const cartAlert = this.querySelector(".delivery-picker-cart-alert");
    if (cartAlert && verified && dateSelected) {
      cartAlert.classList.add("visually-hidden");
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "delivery-date") {
      if (newValue) {
        this.removeAttribute("delivery-error");
        sessionStorage.setItem("deliveryDateSelected", "true");
        window.deliveryDateSelected = true;
      } else {
        sessionStorage.setItem("deliveryDateSelected", "false");
        window.deliveryDateSelected = false;
      }
      this.updateCartAlert();
      this.dispatchEvent(new CustomEvent("delivery-picker:updated", {
        bubbles: true,
        detail: { deliveryDate: newValue }
      }));
    }

    if (name === "zip-code") {
      if (!!newValue) {
        localStorage.setItem("delivery-picker:zip-code", newValue);
        this.#showDeliveryZones();
        if (this.deliveryZone) {
          sessionStorage.setItem("postcodeVerified", "true");
          window.postcodeVerified = true;
        } else {
          sessionStorage.setItem("postcodeVerified", "false");
          window.postcodeVerified = false;
        }
      } else {
        this.#hideDeliveryZones();
        sessionStorage.setItem("postcodeVerified", "false");
        window.postcodeVerified = false;
      }
      this.updateCartAlert();
    }
  }

  #clearDeliveryDate() {
    this.setAttribute("delivery-date", "");
    this.setAttribute("delivery-day", "");

    this.#updateCart("", "");
    this.#showDeliveryZones();
  }

  #handleDeliveryZoneSelection(event) {
    event.preventDefault();

    const newDeliveryDate = event.currentTarget.dataset.deliveryDate;
    const newDeliveryDay = event.currentTarget.dataset.deliveryDay;

    this.setAttribute("delivery-date", newDeliveryDate);
    this.setAttribute("delivery-day", newDeliveryDay);

    this.#updateCart(newDeliveryDate, newDeliveryDay);
    this.#showDeliveryZones();
  }

  #handleFormSubmission(event) {
    event.preventDefault();
    this.zipCode = this.zipCodeEl.value;
    
    const errorEl = this.querySelector(".delivery-picker__error");
    if (errorEl && this.defaultErrorText) {
      errorEl.textContent = this.defaultErrorText;
    }
    
    if(!this.deliveryZone) {
       this.setAttribute("delivery-error", true);
       sessionStorage.setItem("postcodeVerified", "false");
       window.postcodeVerified = false;
    } else {
       this.removeAttribute("delivery-error");
       sessionStorage.setItem("postcodeVerified", "true");
       window.postcodeVerified = true;
    }
  }

  #hideDeliveryZones() {
    this.deliveryZonesEl.classList.add("visually-hidden");
  }

  #updateFlag() {
    const selectedOption = this.countryEl.options[this.countryEl.selectedIndex];
    const flagUrl = selectedOption.dataset.flagUrl;
    const flagImg = this.element.querySelector("#current_country_flag");
    if (flagImg) {
      if (flagUrl) {
        flagImg.src = flagUrl;
        flagImg.style.display = "block";
      } else {
        flagImg.style.display = "none";
      }
    }
  }

  #showDeliveryZones() {
    const minOffset = this.#getMinOffset();
    const maxOffset = this.#getMaxOffset();

    [...this.deliveryZonesEl.querySelectorAll(".delivery-zone")].forEach((deliveryZoneEl) => {
      if (deliveryZoneEl.dataset.deliveryDate == this.deliveryDate) {
        deliveryZoneEl.classList.add("delivery-zone--active");
      } else {
        deliveryZoneEl.classList.remove("delivery-zone--active");
      }

      const offset = parseInt(deliveryZoneEl.dataset.deliveryOffset, 10);
      const dayMatch = this.deliveryZone && this.deliveryZone.days.includes(deliveryZoneEl.dataset.deliveryDay);
      const offsetMatch = minOffset === null || offset >= minOffset;
      const withinWeekMatch = maxOffset === null || offset <= maxOffset;

      if (dayMatch && offsetMatch && withinWeekMatch) {
        deliveryZoneEl.classList.remove("visually-hidden");
      } else {
        deliveryZoneEl.classList.add("visually-hidden");
      }
    });

    this.deliveryZonesEl.classList.remove("visually-hidden");
  }

  #getMaxOffset() {
    if (!this.hasAttribute("restrict-next-week")) return null;
    const orderDay = new Date().getDay(); 
    if (orderDay !== 1 && orderDay !== 2) return null;
    return 7 - orderDay;
  }

  #getMinOffset() {
    if (!this.deliveryZone) return null;
    const orderDay = new Date().getDay(); 

    const minOffsetsByZone = {
      zone1: [3, 2, 3, 5, 4, 5, 4],
      zone2: [2, 3, 2, 6, 5, 4, 3],
      zone3: [2, 3, 2, 6, 5, 4, 3],
      zone4: [2, 3, 2, 5, 4, 4, 3],
    };

    const zoneId = this.deliveryZone.zoneId;

    if (zoneId === "zone5") {
      const minLeadDays = orderDay === 0 ? 3 : 4;
      for (let offset = minLeadDays; offset <= 14; offset++) {
        const targetDay = (orderDay + offset) % 7;
        if (targetDay === 3 || targetDay === 4) return offset;
      }
      return minLeadDays;
    }

    return minOffsetsByZone[zoneId]?.[orderDay] ?? null;
  }

  #updateCart(deliveryDate, deliveryDay) {
    this.setAttribute("loading", true);

    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", },
      body: JSON.stringify({ attributes: { "Delivery Date": deliveryDate, "Delivery Day": deliveryDay } }),
    })
      .then((cart) => this.setAttribute("loading", false))
      .catch((error) => this.setAttribute("loading", false));
  }

  get deliveryZones() {
    return [
      { zoneId: "zone1", countryCode: "NL", localDelivery: true,  startsAt: 1000,  endsAt: 4299,   days: [ "monday", "wednesday", "friday" ] },
      { zoneId: "zone2", countryCode: "NL", localDelivery: true,  startsAt: 4300,  endsAt: 9999,   days: [ "tuesday", "thursday" ] },
      { zoneId: "zone3", countryCode: "BE", localDelivery: true,  startsAt: 1000,  endsAt: 9999,   days: [ "tuesday", "thursday" ] },
      { zoneId: "zone4", countryCode: "DE", localDelivery: true,  startsAt: 40000, endsAt: 47999,  days: [ "monday", "tuesday", "wednesday", "thursday" ] },
      { zoneId: "zone4", countryCode: "DE", localDelivery: true,  startsAt: 50000, endsAt: 53999,  days: [ "monday", "tuesday", "wednesday", "thursday" ] },
      { zoneId: "zone5", countryCode: "DE", localDelivery: false, startsAt: 0,     endsAt: 39999,  days: [ "wednesday", "thursday" ] },
      { zoneId: "zone5", countryCode: "DE", localDelivery: false, startsAt: 48000, endsAt: 49999,  days: [ "wednesday", "thursday" ] },
      { zoneId: "zone5", countryCode: "DE", localDelivery: false, startsAt: 54000, endsAt: 100000, days: [ "wednesday", "thursday" ] },
    ];
  }

  get deliveryDate() {
    return this.getAttribute("delivery-date");
  }

  get deliveryZone() {
    if (!this.zipCode || Number.isNaN(this.zipCodeDigits)) return null;

    const deliveryZonesForCountry = this.deliveryZones.filter(deliveryZone => deliveryZone.countryCode === this.countryEl.value);
    return deliveryZonesForCountry.find(zone => this.zipCodeDigits >= zone.startsAt && this.zipCodeDigits <= zone.endsAt) || null;
  }

  set zipCode(value) {
    this.setAttribute("zip-code", value);
  }

  get zipCode() {
    return this.getAttribute("zip-code");
  }

  get zipCodeDigits() {
    if (!this.zipCode) return null;
    return this.zipCode.replace(/\D/g, "");
  }
}

customElements.define('delivery-picker', DeliveryPicker);


