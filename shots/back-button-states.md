# Inputs rail — final state table (shipped rules)

Grounded in `tools/launcher-host/native/34-keys.js` handleKey order:
idle wake → armIdle → settings → overlay → countdown-cancel →
collapsed block → MENU → RED → YELLOW → digits (dead on Inputs) →
inputs open-state block → home open-state block.

Three shapes on Inputs, plus Home's rail:

- **N** nav mode — lid down, page stands alone
- **P** ports-only — lid up, one row (the ports row; entry shape)
- **E** expanded — lid up, data row rides above the ports row;
  ring may sit on either row (E-ports / E-data)

One selector per page: the ring exists on exactly one block. Each
row keeps its own paging window; the ring moves between rows by
lane hop (same column, clamped) and always survives a fold with
tile identity.

## BACK (Inputs)

| Shape when BACK pressed | Result |
|---|---|
| N | page-nav → Home (BACK from Home = vendor, always) |
| P | fold rail to N, **stay on Inputs** |
| E (either focus) | one press folds **both** rows to N, stay on Inputs |

Two-stage ladder: rail open (any shape) → BACK folds in place →
BACK pages Home. BACK never jumps pages from an open rail, and
never unwinds only half.

## UP ladder (Inputs)

| Shape | Result |
|---|---|
| N | lift lid → P (entry is always folded, focus = first port) |
| P | raise the data row above the ports → E-ports (focus stays) |
| E-ports | lane hop up → E-data (same column clamped) |
| E-data | falls through to the vendor (top of the world) |

## DOWN (Inputs)

| Shape | Result |
|---|---|
| E (either focus) | fold to P; if the ring was on data it descends to the ports row, same column clamped |
| P | close lid → N |

DOWN in expanded mode **always** folds — from the data row it
collapses and navigates down in one key ("collapse + navigate to
the rail below"), from the ports row it just collapses.

## LEFT / RIGHT (Inputs, lid up)

- Within a row: that row pages (its own window from its own sel).
- Data row LEFT at 0 → handover to ports row far end;
  ports row RIGHT at data's-far-end equivalent → back-handover.
- Ports row LEFT at 0 → page-nav ← Home.
- Ports row RIGHT at end → clamp, no wrap.

## Digits

- Inputs: **dead**. Folded + digit = blind lift (key consumed,
  no source switch). Lid up + digit = falls to the vendor.
  No digit switches a source on Inputs — the old flat-order
  index crossed lanes and was a wrong fact waiting to happen.
- Home: digits still live as before.

## Timeout & bookkeeping

- 30 s silence (kit.RAIL_LID_MS): closeLid() — expanded force-folds
  all the way to N. Re-entry always starts P.
- Entry focus: applySmartFocus — last-used port, else first
  reporting port (deviceName truth), else first port. Always
  lands folded on the ports row.
- Row split truth (kit.isPort): HDMI/COMPONENT/AV prefixes; SC
  only as the connector word (SC/SC1/SCART) — "SCREEN SHARE"
  starts with SC and belongs to the data row (panel-proven trap).
- Green truth: deviceName only. Whole tile green (border, letter,
  code, title) when a device reports itself; fully grey otherwise.
- Footer cue `^ DATA`: shows only while the data row is hidden
  (P shape, data exists); hidden in E and in N — modal to row
  state, not to focus. `^` is the pixel font's third arrow, same
  5x7 cell as `<` / `>`.

## Diagrams

- `shots/back-button-ladder.png` — BACK ladder
- `shots/inputs-rail-states.png` — shape ladder under UP/DOWN/BACK

(Regenerate via mermaid.ink after any rule change; sources live in
this file's history.)
