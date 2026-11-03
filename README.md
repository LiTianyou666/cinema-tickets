# Cinema.Tickets

Cinema ticket booking frontend. Plain HTML, CSS and JavaScript. No frameworks, no build step.

## Run

Open the folder in VS Code, install the Live Server extension, right click `index.html`
and choose "Open with Live Server". The app opens on `http://127.0.0.1:5500/index.html`.

A local HTTP server is required: ES modules and the SVG icon sprite do not load from `file://`.

## Pages

| Page | Address |
| --- | --- |
| Movie catalogue | `index.html` |
| Movie | `movie.html?id=...&date=...` |
| Session and seats | `session.html?id=...` |
| Cart | `cart.html` |
| Checkout | `purchase.html` |
| Bookings | `bookings.html` |
| Booking details | `booking.html?id=...` |
| Log in | `login.html?returnUrl=...` |
| Registration | `registration.html` |
| Profile | `profile.html` |

## Structure

```
*.html             ten pages
kit/               UI kit: tokens.css, base.css, layout.css, components.css, icons.svg
js/api.js          all requests, access token, refresh on 401, error object
js/config.js       server settings from GET /api/config, cached
js/format.js       date, money, duration and enum formats
js/ui.js           toast, alert, field errors, loading state
js/auth.js         login state, header, access control, logout
js/phone.js        phone mask
js/cart-groups.js  cart items grouped by session
js/pages/*.js      one script per page
```

## Notes

- Limits such as seat hold time, maximum seats per session, cut-off minutes and page sizes
  are read from `GET /api/config`. They are not written in the code.
- The filters, the page number and the selected date are kept in the URL query string,
  so a reload keeps the same state.
- Each page has a `Content-Security-Policy` meta tag that blocks external styles.
  The kit `base.css` imports Google Fonts; when that host is unreachable the request hangs
  and the browser delays script execution, so external styles are blocked on purpose.
