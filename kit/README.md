# Cinema.Tickets UI kit

The kit contains the styles and icons of the client application "Cinema.Tickets". The application is implemented in vanilla HTML and JavaScript; all visual design is provided by the kit. The reference markup of every screen is given in `cinema-mockups.html`.

## 1. Files

| File | Content |
|---|---|
| `tokens.css` | Design tokens: colors, typography, spacing, radii, elevation, layout sizes, motion, stacking order |
| `base.css` | Reset, typography of bare elements, focus styles; loads the Inter font from Google Fonts |
| `layout.css` | Page layout classes `l-*` |
| `components.css` | Components `c-*`, state classes `is-*`, utilities `u-*` |
| `icons.svg` | SVG sprite of 21 icons |

The files are connected in every page in this order and are not modified:

```html
<link rel="stylesheet" href="../kit/tokens.css">
<link rel="stylesheet" href="../kit/base.css">
<link rel="stylesheet" href="../kit/layout.css">
<link rel="stylesheet" href="../kit/components.css">
```

Rules:

1. The pages contain no own style sheets, `<style>` blocks or `style` attributes. The only permitted inline styles are the custom properties `--rating` (on `c-stars`) and `--seat-cols` (on `c-seatmap`).
2. All states are expressed by native pseudo-classes, attributes or the state classes listed in section 6. JavaScript changes attributes and classes; it does not set styles.
3. The pages are opened through a local HTTP server (for example, Live Server at `http://127.0.0.1:5500`). Browsers do not load the external icon sprite from `file://` pages.

## 2. Naming convention

| Prefix | Meaning | Example |
|---|---|---|
| `l-` | Layout | `l-container`, `l-split__aside` |
| `c-` | Component | `c-btn`, `c-seat` |
| `u-` | Utility | `u-visually-hidden` |
| `is-` | State set by JavaScript | `is-loading`, `is-error` |

Inside components the BEM notation is used: `c-block`, `c-block__element`, `c-block--modifier`. A modifier is always added together with the base class: `class="c-btn c-btn--primary"`.

## 3. Page skeleton

```html
<body>
  <div class="l-page">
    <header class="l-header">
      <div class="l-container c-header">
        <a class="c-header__logo" href="index.html">
          <svg class="c-icon c-icon--lg" aria-hidden="true"><use href="../kit/icons.svg#icon-logo"></use></svg>
          <span>Cinema.Tickets</span>
        </a>
        <nav class="c-nav" aria-label="Main">
          <a class="c-nav__link" href="index.html" aria-current="page">Movies</a>
          <a class="c-nav__link" href="bookings.html">Bookings</a>
          <a class="c-nav__link" href="cart.html">Cart <span class="c-counter" aria-label="5 tickets in the cart">5</span></a>
        </nav>
        <div class="c-header__user">…</div>
      </div>
    </header>
    <main class="l-main">
      <div class="l-container l-stack l-stack--lg">
        <!-- page content -->
      </div>
    </main>
    <footer class="l-footer">
      <div class="l-container c-footer">© 2026 Cinema.Tickets · Frontend study project</div>
    </footer>
  </div>
</body>
```

The user area of the header has two variants:

- guest: `<a class="c-btn c-btn--secondary c-btn--sm" href="login.html">Log in</a>` and `<a class="c-btn c-btn--primary c-btn--sm" href="registration.html">Register</a>`;
- authorized: `<a class="c-header__email" href="profile.html">` with the user's email and `<button class="c-btn c-btn--ghost c-btn--sm" type="button">Log out</button>`.

## 4. Layout classes

| Class | Purpose |
|---|---|
| `l-page` | Page wrapper; the footer stays at the bottom of short pages |
| `l-header`, `l-main`, `l-footer` | Sticky header, main area, footer |
| `l-container` | Centered column, maximum width 1200 px |
| `l-stack`, `l-stack--sm`, `l-stack--lg` | Vertical flow with gap 16 / 8 / 32 px |
| `l-cluster`, `l-cluster--between`, `l-cluster--end` | Horizontal flow with wrapping; space between; right alignment |
| `l-grid`, `l-grid--cols-2`, `l-grid--cols-3`, `l-grid--cols-4` | Grid of equal columns, gap 24 px |
| `l-split`, `l-split__main`, `l-split__aside` | Main column and a sticky aside of 380 px |
| `l-section`, `l-section__header`, `l-section__title`, `l-section__count` | Section with a heading row |
| `l-narrow`, `l-narrow--wide` | Centered column of 480 / 640 px for forms |
| `l-media`, `l-media--sm` | Media (poster 320 / 72 px) and a flexible content column |

## 5. Icons

```html
<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-clock"></use></svg>
```

Sizes: `c-icon--sm` 16 px, `c-icon` 20 px, `c-icon--lg` 24 px. The icon takes the current text color. An icon-only button has `aria-label`.

Symbols: `icon-logo`, `icon-film`, `icon-star`, `icon-user`, `icon-ticket`, `icon-cart`, `icon-calendar`, `icon-clock`, `icon-hall`, `icon-close`, `icon-trash`, `icon-edit`, `icon-chevron-left`, `icon-chevron-right`, `icon-chevron-down`, `icon-check`, `icon-info`, `icon-warning`, `icon-error`, `icon-logout`, `icon-search`.

## 6. States set by JavaScript

| Component | State | Expression |
|---|---|---|
| `c-nav__link` | Current page | `aria-current="page"` |
| `c-counter` | Empty cart | `hidden` attribute |
| `c-btn` | Unavailable | `disabled` (button), `aria-disabled="true"` (link) |
| `c-btn` | Request in progress | class `is-loading` and `aria-busy="true"`; the text stays in the markup |
| `c-input`, `c-select`, `c-textarea` | Invalid value | `aria-invalid="true"` on the control, a `c-field__error` element referenced by `aria-describedby` |
| `c-field` | Accepted value | modifier `c-field--success` |
| `c-multiselect` | Open list | `open` attribute of `<details>`; `c-multiselect__value` shows "Any", the selected labels (up to two) or "N selected" |
| `c-stars` | Rating | `style="--rating: 7.42"` (0–10); `c-stars__value` and `c-stars__count` hold the texts; without reviews `c-stars__none` with "No ratings yet" |
| `c-stars-input` | Selection | `checked` radio button; `c-stars-input__value` shows "8 / 10"; `aria-invalid="true"` on the radio buttons |
| `c-pagination__link` | Current page, unavailable link | `aria-current="page"`; `aria-disabled="true"` without `href` |
| `c-date-tabs__tab` | Selected date, date without sessions | `aria-current="date"`; `aria-disabled="true"` without `href` |
| `c-session` | Booking closed | `aria-disabled="true"` without `href`, text "Booking closed" in `c-session__price` |
| `c-seatmap` | Loading | `aria-busy="true"` |
| `c-seat` | Free | `aria-pressed="false"` |
| `c-seat` | Occupied | `disabled` |
| `c-seat` | In the cart of the user | `aria-pressed="true"` |
| `c-seat` | Request in progress | class `is-loading` |
| `c-seat` | Booking of the session closed | `disabled` together with `aria-pressed="false"` on free seats |
| `c-cart-group` | Booking closed for the session | class `is-error` and a `c-cart-group__error` line |
| `c-timer` | Less than 2 minutes, hold ended | classes `is-warning`, `is-expired` |
| `c-promo` | Checking, applied, rejected | classes `is-loading`, `is-success` (with `c-promo__applied`), `is-error` (with `aria-invalid="true"` on the input and `c-promo__message`) |
| `c-poster` | Image loading | class `is-loading` |
| Container of cards | Loading | `aria-busy="true"` on the container and `c-skeleton` placeholders |
| `c-dialog` | Open | `dialog.showModal()` and `dialog.close()`; the mockups show the `open` attribute |
| `c-toast-stack` | Notification | a `c-toast` element is appended to the stack and removed by its close button |

Mapping of API values to display values:

| API value | Component | Display |
|---|---|---|
| `Age0`, `Age6`, `Age12`, `Age16`, `Age18` | `c-age` | `0+`, `6+`, `12+`, `16+`, `18+` |
| `TwoD`, `ThreeD`, `Imax` | `c-format` | `2D`, `3D`, `IMAX` |
| `Active`, `Completed`, `Cancelled` | `c-status--active`, `c-status--completed`, `c-status--cancelled` | `Active`, `Completed`, `Cancelled` |
| `Standard`, `Vip` | `c-seat`, `c-seat--vip`; `c-badge--neutral` in seat lists | `Standard`, `VIP` |
| `SciFi` | genre text | `Sci-Fi` |

Display formats of money, dates, times and durations are defined in section 9 of the design specification.

## 7. Components

| # | Root class | Elements and modifiers |
|---|---|---|
| 1 | `c-header` | `__logo`, `__user`, `__email`; navigation `c-nav`, `c-nav__link` |
| 2 | `c-counter` | — |
| 3 | `c-footer` | — |
| 4 | `c-btn` | `--primary`, `--secondary`, `--ghost`, `--danger`, `--link`; `--sm`, `--lg`, `--block`, `--icon`. `--danger` with `--secondary` or `--ghost` changes only the text and border color |
| 5 | `c-field` | `__label`, `__hint`, `__error`, `__row`; `--success`; controls `c-input`, `c-select`, `c-textarea` |
| 6 | `c-static` | `__label`, `__value` |
| 7 | `c-check`, `c-radio` | `__input`, `__box`; the label text follows the box |
| 8 | `c-switch` | `__input` (`role="switch"`), `__track` |
| 9 | `c-choice-card` | `__input`, `__body`, `__title`, `__text` |
| 10 | `c-multiselect` | `<details>`; `__summary`, `__label`, `__control`, `__value`, `__panel`, `__option` (a `c-check`) |
| 11 | `c-filter-bar` | `<form method="get">`; `__filters`, `__toggle`, `__actions` |
| 12 | `c-card` | `__header`, `__title`, `__body`, `__footer`; `--clickable` |
| 13 | `c-poster` | `__img`; `--xs` (48 px), `--sm` (72 px), `--md` (container width), `--lg` (320 px) |
| 14 | `c-movie-card` | `__media`, `__badge`, `__title`, `__link` (covers the whole card), `__meta` |
| 15 | `c-badge` | `--neutral`, `--accent`, `--success`, `--warning`, `--danger`, `--info` |
| 16 | `c-age` | — |
| 17 | `c-format` | — |
| 18 | `c-status` | `--active`, `--completed`, `--cancelled` |
| 19 | `c-stars` | `__icons` (`role="img"` with `aria-label`), `__value`, `__count`, `__none`; `--sm`, `--lg` |
| 20 | `c-stars-input` | `<fieldset>`; `__legend`, `__row`, `__stars`, `__star`, `__radio`, `__value` |
| 21 | `c-pagination` | `__link`, `__ellipsis` |
| 22 | `c-date-tabs` | `__tab`, `__day`, `__date` |
| 23 | `c-session-group` | `__header`, `__halls`, `__list` |
| 24 | `c-session` | `__time`, `__hall`, `__price` |
| 25 | `c-seatmap` | `__screen`, `__rows`, `__row`, `__label`; `style="--seat-cols: N"` |
| 26 | `c-seat` | `<button>`; `--vip`; label `aria-label="Row 7, Seat 11, Standard, 700 ₽"`; no text inside |
| 27 | `c-legend` | `__item`, `__seat` (with `c-seat`), `__seat--occupied`, `__seat--mine` |
| 28 | `c-summary` | `__title`, `__list`, `__lines` (`<dl>`), `__line`, `__line--discount`, `__total`, `__actions`, `__note` |
| 29 | `c-cart-group`, `c-cart-seat` | `__header`, `__info`, `__title`, `__meta`, `__error`, `__seats`, `__footer`; `c-cart-seat__label`, `__price` |
| 30 | `c-timer` | — |
| 31 | `c-promo` | `__form`, `__input`, `__message`, `__applied`, `__code` |
| 32 | `c-booking-item` | `__main`, `__title`, `__meta`, `__code`, `__tickets`, `__total`, `__actions` |
| 33 | `c-table` | `c-table__num` on numeric cells; footer rows `c-table__foot-row`, `--discount`, `--total` |
| 34 | `c-dl` | `__row`, `__term`, `__desc` |
| 35 | `c-review` | `__header`, `__author`, `__date`, `__text`, `__actions`; `--mine` |
| 36 | `c-review-form` | `__title`, `__meta`, `__counter`, `__actions` |
| 37 | `c-alert` | `__icon`, `__body`, `__title`, `__action`; `--info`, `--success`, `--warning`, `--danger` |
| 38 | `c-toast-stack`, `c-toast` | `c-toast__icon`, `__text`, `__close`; `--success`, `--danger`, `--info` |
| 39 | `c-dialog` | native `<dialog>`; `__title`, `__text`, `__actions` |
| 40 | `c-empty` | `__icon`, `__title`, `__text`, `__action`; `--error` |
| 41 | `c-spinner` | `--sm`, `--lg` |
| 42 | `c-skeleton` | `--text`, `--title`, `--poster`, `--block` |
| 43 | `c-back-link` | — |
| 44 | `c-page-title` | `__main`, `__head`, `__subtitle`, `__item`, `__actions` |

Utilities: `u-visually-hidden`, `u-muted`, `u-nowrap`, `u-truncate`, `u-text-right`, `u-tabular`, `u-mt-0` … `u-mt-8`, `u-mb-0` … `u-mb-8`.

## 8. Accessibility

1. Every control has a `<label>`; a group of radio buttons is a `<fieldset>` with a `<legend>`.
2. An icon-only button has `aria-label` ("Remove row 7, seat 11", "Close").
3. Decorative icons have `aria-hidden="true"`. A poster next to the movie title has `alt=""`.
4. Every seat button has an `aria-label` with row, seat, type and price, or with "occupied".
5. Error messages are referenced from the control by `aria-describedby`; alerts about errors and warnings have `role="alert"`, other alerts and toasts `role="status"`.
6. Focus is shown by the kit on every focusable element; the pages do not remove outlines.

## 9. Reference mockups

`cinema-mockups.html` contains the kit catalog (sections K1–K8, each component with its markup) and every screen state (sections S01a–S10d) with the identifier, the state and the page address in the caption. The markup inside a section is the reference markup of the page. When it is copied into a page, three differences of the single-file document are removed:

| In `cinema-mockups.html` | In a page of the application |
|---|---|
| Icons reference the inline sprite: `href="#icon-star"` | `href="../kit/icons.svg#icon-star"` |
| Element identifiers carry the section prefix: `id="S05a-review-text"` | `id="review-text"` |
| Posters are embedded images (`data:` URLs) | `src` is the `posterUrl` value returned by the API |

Links in the mockups point to the pages of the application (`movie.html?id=…`, `session.html?id={sessionId}`); values in braces are replaced with identifiers from the API.
