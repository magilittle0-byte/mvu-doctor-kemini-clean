# World action button theme correction

The current TauriTavern dark theme renders the enabled world repair and refresh
buttons with text rgb(219, 219, 214) over the browser default rgb(240, 240, 240).
Both buttons have disabled=false and opacity=1. A full native-size compositor
capture confirms that their labels are difficult to read. This is a UI styling
failure, independent of model output and of the earlier viewport-size incident.

Source review completed before changing runtime files:

- `world/entry.js` loads `world/style.css` for `world/surface.mjs`.
- `world/surface.mjs` creates ordinary buttons. Repair is disabled only while
  busy; its callback already invokes the existing retry mechanism.
- `world/style.css` supplies spacing and a disabled state but omits button
  foreground, background and border theme colors.
- The locked `profiles/style.css` and `modular/style.css` already use inherited
  foreground plus `--SmartThemeBlurTintColor` and `--SmartThemeBorderColor` with
  dark fallbacks. Their UI constructors also use ordinary buttons.
- The archived Doctor UI uses the host `menu_button` class. Adding that class
  would also import host sizing and layout behavior, so it is unnecessary here.

Reuse the three existing color/border declarations in the world button selector.
Keep its current spacing, click handlers, busy state and disabled behavior.
No new mechanism is required; no P1/P2 source, model prompt, world evolution or
persistence change is needed.

Validation: inspect actual installed CSS and full-window rendering on the real
host; verify both action buttons are enabled when settled and their theme colors
match the existing module buttons. Recheck P1/P2 locks. Controlled checks alone
do not constitute real acceptance. The previous world candidate's round evidence
does not accept this changed fingerprint; a new twelve-round run is required.
