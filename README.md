# Token Action HUD - Vagabond

A [Token Action HUD Core](https://github.com/Larkinabout/fvtt-token-action-hud-core) integration for the [Vagabond RPG](https://github.com/mordachai/vagabond) system on Foundry VTT.

Make rolls, use items, cast spells, and manage conditions directly from the HUD — without ever opening your character sheet.

---

## Features

- **Weapons** — Click to roll attacks and damage. Right-click to open the item sheet.
- **Spells** — Full spell casting dialog with damage dice, delivery type, area increase, mana tracking, and template placement.
- **Skills & Saves** — Roll any skill or save directly. Trained skills are marked with a checkmark.
- **Favor / Hinder** — Set your roll modifier from the HUD. Hold Shift to Favor or Ctrl to Hinder on any roll.
- **Conditions** — Toggle status conditions with a single click.
- **Luck** — Spend or gain Luck from the HUD with chat card feedback.
- **Class Features & Ancestry Traits** — Post feature descriptions to chat.
- **Perks & Equipment** — Quick access to all your items.
- **NPC Support** — Actions and abilities for NPC tokens.
- **Customizable** — Unlock the HUD to rearrange, hide, or add groups. Add macros, Journal Entries, and Roll Table compendiums.

---

## Installation

1. In Foundry VTT Setup, go to **Add-on Modules → Install Module**
2. Paste the manifest URL into the **Manifest URL** field at the bottom:
   ```
   https://github.com/DimitroffVodka/token-action-hud-vagabond/releases/latest/download/module.json
   ```
3. Click **Install**

---

## Requirements

| Module | Version |
|--------|---------|
| [Token Action HUD Core](https://foundryvtt.com/packages/token-action-hud-core) | 2.0+ |
| [socketlib](https://foundryvtt.com/packages/socketlib) | any |

> Token Action HUD Core requires the **socketlib** library module.

---

## Compatibility

| Foundry VTT | Vagabond System | Status |
|-------------|-----------------|--------|
| v13 | latest | ✅ Verified |
| v12 | latest | ✅ Supported |

---

## Recommended Modules

- **[Color Picker](https://foundryvtt.com/packages/color-picker)** — Enables the color picker in Token Action HUD settings.

---

## Usage Tips

- **Left-click** an action to roll it
- **Right-click** an item to open its sheet
- **Shift+click** any roll for Favor
- **Ctrl+click** any roll for Hinder
- **Unlock the HUD** (padlock icon) to customize groups and add your own macros

---

## Credits

Created by **DimitroffVodka**

Built for the [Vagabond RPG](https://landoftheblind.myshopify.com/) by Land of the Blind.
