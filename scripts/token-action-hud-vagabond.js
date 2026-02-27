/**
 * Token Action HUD - Vagabond
 * System integration for the Vagabond RPG
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const MODULE_ID = "token-action-hud-vagabond";
const REQUIRED_CORE_MODULE_VERSION = "2.0";

// Action types
const ACTION_TYPE = {
  weapon:    "tokenActionHud.vagabond.weapon",
  spell:     "tokenActionHud.vagabond.spell",
  perk:      "tokenActionHud.vagabond.perk",
  equipment: "tokenActionHud.vagabond.equipment",
  stat:      "tokenActionHud.vagabond.stat",
  skill:     "tokenActionHud.vagabond.skill",
  save:      "tokenActionHud.vagabond.save",
  utility:   "tokenActionHud.utility",
};

// Groups shown in the HUD
const GROUP = {
  weapons:   { id: "weapons",   name: "tokenActionHud.vagabond.weapons",   type: "system" },
  spells:    { id: "spells",    name: "tokenActionHud.vagabond.spells",    type: "system" },
  perks:     { id: "perks",     name: "tokenActionHud.vagabond.perks",     type: "system" },
  equipment: { id: "equipment", name: "tokenActionHud.vagabond.equipment", type: "system" },
  skills:    { id: "skills",    name: "tokenActionHud.vagabond.skills",    type: "system" },
  saves:     { id: "saves",     name: "tokenActionHud.vagabond.saves",     type: "system" },
  npcActions:   { id: "npc-actions",   name: "tokenActionHud.vagabond.npcActions",   type: "system" },
  npcAbilities: { id: "npc-abilities", name: "tokenActionHud.vagabond.npcAbilities", type: "system" },
  conditions:   { id: "conditions",   name: "tokenActionHud.vagabond.conditions",   type: "system" },
  favorHinder:  { id: "favor-hinder",  name: "tokenActionHud.vagabond.favorHinder",  type: "system" },
  luck:      { id: "luck",      name: "tokenActionHud.vagabond.luck",       type: "system" },
  features:  { id: "features",  name: "tokenActionHud.vagabond.features",   type: "system" },
  traits:    { id: "traits",    name: "tokenActionHud.vagabond.traits",     type: "system" },
  combat:    { id: "combat",    name: "tokenActionHud.combat",             type: "system" },
  utility:   { id: "utility",   name: "tokenActionHud.utility",            type: "system" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isWeapon(item) {
  return item.type === "equipment" && item.system?.equipmentType === "weapon";
}

function isEquipped(item) {
  return item.system?.equipmentState !== "unequipped";
}

/** Inline calculateEffectiveFavorHinder (avoids dynamic import) */
function calcFavorHinder(actor, event) {
  const systemState = actor.system?.favorHinder ?? "none";
  const shiftKey = event?.shiftKey ?? false;
  const ctrlKey  = event?.ctrlKey  ?? false;
  let modifierIntent = "none";
  if (shiftKey && !ctrlKey)       modifierIntent = "favor";
  else if (ctrlKey && !shiftKey)  modifierIntent = "hinder";
  if (systemState === "none")     return modifierIntent;
  if (modifierIntent === "none")  return systemState;
  if (systemState === modifierIntent) return systemState;
  return "none"; // opposite — cancel out
}

/** Inline shouldRollDamage (avoids dynamic import) */
function shouldRollDamage(isHit) {
  try {
    const rollWithCheck = game.settings.get("vagabond", "rollDamageWithCheck");
    if (!rollWithCheck) return false;
    const alwaysRoll = game.settings.get("vagabond", "alwaysRollDamage");
    return alwaysRoll || isHit;
  } catch { return false; }
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

let DEFAULTS = null;

function buildDefaults(coreModule) {
  const groups = foundry.utils.deepClone(GROUP);

  Object.values(groups).forEach(group => {
    group.name     = coreModule.api.Utils.i18n(group.name);
    group.listName = `Group: ${group.name}`;
  });

  return {
    layout: [
      {
        nestId: "npc",
        id:     "npc",
        name:   coreModule.api.Utils.i18n("tokenActionHud.vagabond.npc"),
        groups: [
          { ...groups.npcActions,   nestId: "npc_npc-actions"   },
          { ...groups.npcAbilities, nestId: "npc_npc-abilities" },
          { ...groups.conditions,   nestId: "npc_conditions"    },
        ]
      },
      {
        nestId: "combat-actions",
        id:     "combat-actions",
        name:   coreModule.api.Utils.i18n("tokenActionHud.vagabond.combatActions"),
        groups: [
          { ...groups.weapons,   nestId: "combat-actions_weapons"   },
          { ...groups.spells,    nestId: "combat-actions_spells"    },
          { ...groups.perks,     nestId: "combat-actions_perks"     },
          { ...groups.features,  nestId: "combat-actions_features"  },
          { ...groups.traits,    nestId: "combat-actions_traits"    },
        ]
      },
      {
        nestId: "inventory",
        id:     "inventory",
        name:   coreModule.api.Utils.i18n("tokenActionHud.vagabond.inventory"),
        groups: [
          { ...groups.equipment, nestId: "inventory_equipment" },
        ]
      },
      {
        nestId: "attributes",
        id:     "attributes",
        name:   coreModule.api.Utils.i18n("tokenActionHud.vagabond.attributes"),
        groups: [
          { ...groups.skills, nestId: "attributes_skills" },
          { ...groups.saves,  nestId: "attributes_saves"  },
        ]
      },
      {
        nestId: "utility",
        id:     "utility",
        name:   coreModule.api.Utils.i18n("tokenActionHud.utility"),
        groups: [
          { ...groups.favorHinder, nestId: "utility_favor-hinder" },
          { ...groups.conditions,  nestId: "utility_conditions"  },
          { ...groups.luck,        nestId: "utility_luck"         },
          { ...groups.combat,      nestId: "utility_combat"       },
          { ...groups.utility, nestId: "utility_utility" },
        ]
      }
    ],
    groups: Object.values(groups)
  };
}


// ─── SPELL DIALOG ─────────────────────────────────────────────────────────────

/**
 * A dialog for configuring and casting a Vagabond spell from the Token Action HUD.
 * Mirrors the spell configuration UI on the character sheet.
 */
class VagabondSpellDialog extends foundry.applications.api.ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "tah-vagabond-spell-dialog",
    tag: "div",
    window: { title: "Cast Spell", resizable: false },
    position: { width: 360 },
    classes: ["tah-vagabond-spell-dialog"]
  };

  constructor(actor, spell) {
    super();
    this.actor = actor;
    this.spell = spell;
    this.spellState = this.#loadState();
  }

  /** Load or create spell state (mirrors SpellHandler._getSpellState) */
  #loadState() {
    const key = `vagabond.spell-states.${this.actor.id}`;
    const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!stored[this.spell.id]) {
      stored[this.spell.id] = {
        damageDice:      1,
        deliveryType:    null,
        deliveryIncrease: 0,
        useFx:           this.spell.system?.damageType === "-",
      };
    }
    return stored[this.spell.id];
  }

  /** Save state to localStorage so it persists like the character sheet */
  #saveState() {
    const key = `vagabond.spell-states.${this.actor.id}`;
    const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
    stored[this.spell.id] = this.spellState;
    localStorage.setItem(key, JSON.stringify(stored));
  }

  /** Calculate mana costs (mirrors SpellHandler._calculateSpellCost) */
  #calcCost() {
    const s = this.spellState;
    const spell = this.spell;
    const hasDamage = spell.system?.damageType !== "-" && s.damageDice >= 1;
    const damageCost = hasDamage && s.damageDice > 1 ? s.damageDice - 1 : 0;
    const fxCost = s.useFx && hasDamage ? 1 : 0;

    let deliveryBaseCost = s.deliveryType
      ? (CONFIG.VAGABOND.deliveryDefaults[s.deliveryType]?.cost ?? 0) : 0;
    const deliveryReduction = this.actor.system.bonuses?.deliveryManaCostReduction ?? 0;
    deliveryBaseCost = Math.max(0, deliveryBaseCost - deliveryReduction);

    const increasePerStep = s.deliveryType
      ? (CONFIG.VAGABOND.deliveryIncreaseCost[s.deliveryType] ?? 0) : 0;
    const deliveryIncreaseCost = s.deliveryIncrease * increasePerStep;

    const spellReduction = this.actor.system.bonuses?.spellManaCostReduction ?? 0;
    const totalCost = Math.max(0, damageCost + fxCost + deliveryBaseCost + deliveryIncreaseCost - spellReduction);

    return { damageCost, fxCost, deliveryBaseCost, deliveryIncreaseCost, totalCost };
  }

  #getSizeHint() {
    const { deliveryType: dt, deliveryIncrease: di } = this.spellState;
    if (!dt || di === 0) return "";
    const base = CONFIG.VAGABOND.deliveryBaseRanges[dt];
    const inc  = CONFIG.VAGABOND.deliveryIncrement[dt];
    if (!base?.value || inc === 0) return "";
    const v = base.value + inc * di;
    if (base.type === "count")  return `(${v} ${base.unit}${v > 1 ? "s" : ""})`;
    if (base.type === "radius") return `(${v}-${base.unit} radius)`;
    return `(${v}-${base.unit})`;
  }

  /** @override */
  async _prepareContext() {
    const spell = this.spell;
    const s     = this.spellState;
    const costs = this.#calcCost();
    const hasDamage = spell.system?.damageType !== "-";

    const deliveryOptions = Object.entries(CONFIG.VAGABOND.deliveryTypes ?? {}).map(([k, v]) => ({
      value: k,
      label: game.i18n.localize(v),
      selected: k === s.deliveryType
    }));

    const canIncrease = s.deliveryType &&
      (CONFIG.VAGABOND.deliveryIncreaseCost[s.deliveryType] ?? 0) > 0;

    const currentMana = this.actor.system?.mana?.current ?? 0;
    const castingMax  = this.actor.system?.mana?.castingMax ?? 0;
    const canCast = s.deliveryType !== null &&
      costs.totalCost <= currentMana &&
      costs.totalCost <= castingMax;

    return {
      spell,
      s,
      costs,
      hasDamage,
      deliveryOptions,
      canIncrease,
      sizeHint: this.#getSizeHint(),
      currentMana,
      castingMax,
      canCast,
    };
  }

  /** @override */
  async _renderHTML(context) {
    const { spell, s, costs, hasDamage, deliveryOptions, canIncrease, sizeHint, currentMana, castingMax, canCast } = context;

    const deliverySelectOptions = `<option value="">-- Select Delivery --</option>` +
      deliveryOptions.map(o =>
        `<option value="${o.value}" ${o.selected ? "selected" : ""}>${o.label}</option>`
      ).join("");

    const damageSection = hasDamage ? `
      <div class="tah-spell-row">
        <label>Damage Dice</label>
        <div class="tah-spell-controls">
          <button type="button" class="tah-btn tah-dmg-down" title="Decrease (min 0)">−</button>
          <span class="tah-val ${s.damageDice > 1 ? "tah-highlight" : ""}">${s.damageDice}d6</span>
          <button type="button" class="tah-btn tah-dmg-up">+</button>
        </div>
        <span class="tah-cost-badge">${costs.damageCost > 0 ? `+${costs.damageCost}` : "free"}</span>
      </div>
      <div class="tah-spell-row">
        <label>Include Effect</label>
        <button type="button" class="tah-btn tah-fx-toggle ${s.useFx ? "tah-active" : ""}" title="Toggle effect">
          <i class="fas fa-sparkles"></i> ${s.useFx ? "On" : "Off"}
        </button>
        <span class="tah-cost-badge">${costs.fxCost > 0 ? `+${costs.fxCost}` : "free"}</span>
      </div>` :
      `<div class="tah-spell-row tah-muted"><i class="fas fa-sparkles"></i> Effect-only spell (no damage)</div>`;

    const html = `
      <div class="tah-spell-header">
        <img src="${spell.img}" width="36" height="36" style="border-radius:4px">
        <div>
          <strong>${spell.name}</strong>
          <div class="tah-muted">${spell.system?.effect ?? ""}</div>
        </div>
      </div>

      <div class="tah-spell-section">
        ${damageSection}
      </div>

      <div class="tah-spell-section">
        <div class="tah-spell-row">
          <label>Delivery</label>
          <select class="tah-delivery-select">${deliverySelectOptions}</select>
        </div>
        ${s.deliveryType ? `
        <div class="tah-spell-row">
          <label>Increase</label>
          <div class="tah-spell-controls">
            <button type="button" class="tah-btn tah-inc-down" ${s.deliveryIncrease === 0 ? "disabled" : ""}>−</button>
            <span class="tah-val">${s.deliveryIncrease} <span class="tah-muted">${sizeHint}</span></span>
            <button type="button" class="tah-btn tah-inc-up" ${!canIncrease ? "disabled" : ""}>+</button>
          </div>
          <span class="tah-cost-badge">+${costs.deliveryBaseCost + costs.deliveryIncreaseCost}</span>
        </div>` : ""}
      </div>

      <div class="tah-spell-section tah-mana-summary">
        <span>Mana: <strong class="${costs.totalCost > currentMana ? "tah-error" : ""}">${costs.totalCost}</strong> / ${currentMana} (max cast: ${castingMax})</span>
      </div>

      <div class="tah-spell-footer">
        <button type="button" class="tah-btn tah-cast-btn ${canCast ? "" : "disabled"}" ${canCast ? "" : "disabled"}>
          <i class="fas fa-wand-sparkles"></i> Cast
        </button>
        <button type="button" class="tah-btn tah-cancel-btn">Cancel</button>
      </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }

  /** @override */
  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  /** @override */
  _attachFrameListeners() {
    super._attachFrameListeners();

    this.element.addEventListener("change", e => {
      if (e.target.classList.contains("tah-delivery-select")) {
        this.spellState.deliveryType = e.target.value || null;
        this.spellState.deliveryIncrease = 0;
        this.#saveState();
        this.render();
      }
    });

    this.element.addEventListener("click", async e => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.classList.contains("tah-dmg-up")) {
        if (this.spellState.damageDice === 0) this.spellState.useFx = false;
        this.spellState.damageDice++;
        this.#saveState(); this.render();
      } else if (btn.classList.contains("tah-dmg-down")) {
        if (this.spellState.damageDice > 0) {
          this.spellState.damageDice--;
          if (this.spellState.damageDice === 0) this.spellState.useFx = true;
        }
        this.#saveState(); this.render();
      } else if (btn.classList.contains("tah-fx-toggle")) {
        this.spellState.useFx = !this.spellState.useFx;
        this.#saveState(); this.render();
      } else if (btn.classList.contains("tah-inc-up")) {
        this.spellState.deliveryIncrease++;
        this.#saveState(); this.render();
      } else if (btn.classList.contains("tah-inc-down")) {
        if (this.spellState.deliveryIncrease > 0) this.spellState.deliveryIncrease--;
        this.#saveState(); this.render();
      } else if (btn.classList.contains("tah-cast-btn") && !btn.disabled) {
        await this.#cast(e);
      } else if (btn.classList.contains("tah-cancel-btn")) {
        this.close();
      }
    });
  }

  async #cast(event) {
    const costs = this.#calcCost();
    const actor = this.actor;
    const spell = this.spell;
    const state = this.spellState;

    if (!state.deliveryType) {
      ui.notifications.warn("Select a delivery type first!"); return;
    }
    if (costs.totalCost > actor.system.mana.current) {
      ui.notifications.error(`Not enough mana! Need ${costs.totalCost}, have ${actor.system.mana.current}.`); return;
    }
    if (costs.totalCost > actor.system.mana.castingMax) {
      ui.notifications.error(`Exceeds casting max of ${actor.system.mana.castingMax}.`); return;
    }

    const manaSkillKey = actor.system.classData?.manaSkill;
    if (!manaSkillKey) { ui.notifications.error("No mana skill configured!"); return; }
    if (!actor.system.classData?.isSpellcaster) { ui.notifications.warn("Your class cannot cast spells!"); return; }
    if (actor.system.autoFailAllRolls) {
      const { VagabondChatCard } = globalThis.vagabond.utils;
      await VagabondChatCard.autoFailRoll(actor, "spell", spell.name);
      ui.notifications.warn(`${actor.name} cannot cast spells due to status conditions.`);
      return;
    }

    const targets = Array.from(game.user.targets).map(t => ({
      tokenId: t.id, sceneId: t.scene.id,
      actorId: t.actor?.id, actorName: t.name, actorImg: t.document.texture.src,
    }));

    const skill = actor.system.skills[manaSkillKey];
    const difficulty = skill.difficulty;

    let roll = null, isSuccess = false, isCritical = false;

    if (spell.system.noRollRequired) {
      isSuccess = true;
    } else {
      const { VagabondRollBuilder } = await import("/systems/vagabond/module/helpers/roll-builder.mjs");
      const rollData = actor.getRollDataWithItemEffects(spell);
      const favorHinder = VagabondRollBuilder.calculateEffectiveFavorHinder(
        actor.system.favorHinder || "none", event?.shiftKey ?? false, event?.ctrlKey ?? false
      );
      roll = await VagabondRollBuilder.buildAndEvaluateD20WithRollData(rollData, favorHinder);
      isSuccess = roll.total >= difficulty;
      const critNum = VagabondRollBuilder.calculateCritThreshold(rollData, "spell");
      const d20 = roll.terms.find(t => t.constructor.name === "Die" && t.faces === 20);
      isCritical = (d20?.results?.[0]?.result ?? 0) >= critNum;
    }

    if (isSuccess) {
      await actor.update({ "system.mana.current": actor.system.mana.current - costs.totalCost });
    }

    // Build delivery text
    const { VagabondDamageHelper } = await import("/systems/vagabond/module/helpers/damage-helper.mjs");
    const deliveryName = game.i18n.localize(CONFIG.VAGABOND.deliveryTypes[state.deliveryType]);
    const base = CONFIG.VAGABOND.deliveryBaseRanges[state.deliveryType];
    const inc  = CONFIG.VAGABOND.deliveryIncrement[state.deliveryType];
    const totalVal = base?.value ? base.value + inc * state.deliveryIncrease : null;
    const areaText = totalVal ? (base.type === "count" ? `${totalVal} target${totalVal > 1 ? "s" : ""}` : `${totalVal}'`) : "";
    const deliveryText = areaText ? `${deliveryName} ${areaText}` : deliveryName;

    const manaSkill = actor.system.skills[manaSkillKey];
    let damageRoll = null;
    if (spell.system.damageType !== "-" && state.damageDice > 0 && VagabondDamageHelper.shouldRollDamage(isSuccess)) {
      damageRoll = await VagabondDamageHelper.rollSpellDamage(actor, spell, state, isCritical, manaSkill?.stat ?? "reason");
    }

    const { VagabondChatCard } = globalThis.vagabond.utils;
    await VagabondChatCard.spellCast(actor, spell, {
      roll, difficulty, isSuccess, isCritical,
      manaSkill, manaSkillKey,
      spellState: state, costs, deliveryText,
    }, damageRoll, targets);

    // Reset state (keep delivery)
    this.spellState.damageDice = 1;
    this.spellState.deliveryIncrease = 0;
    this.spellState.useFx = spell.system?.damageType === "-";
    this.#saveState();

    await this.close();
    Hooks.callAll("forceUpdateTokenActionHud");
  }

  static async show(actor, spell) {
    const dialog = new VagabondSpellDialog(actor, spell);
    await dialog.render(true);
  }
}

// ─── ACTION HANDLER ───────────────────────────────────────────────────────────

let ActionHandler = null;

Hooks.once("tokenActionHudCoreApiReady", async coreModule => {

  ActionHandler = class VagabondActionHandler extends coreModule.api.ActionHandler {

    /** @override */
    async buildSystemActions(groupIds) {
      this.actors = this.actor ? [this.actor] : this.#getValidActors();
      this.tokens = this.token ? [this.token] : this.#getValidTokens();

      if (this.actor) {
        this.items = Array.from(coreModule.api.Utils.sortItemsByName(this.actor.items).values());
      }

      const type = this.actor?.type;
      if (type === "npc") {
        await this.#buildNPCActions();
        await this.#buildNPCAbilities();
        this.#buildConditions();
      } else if (type === "character") {
        await this.#buildCharacterActions();
      } else if (!this.actor) {
        this.#buildSkills();
        this.#buildSaves();
        this.#buildCombat();
        this.#buildUtility();
      }
    }

    /* -------------------------------------------- */

    async #buildCharacterActions() {
      await Promise.all([
        this.#buildWeapons(),
        this.#buildSpells(),
        this.#buildPerks(),
        this.#buildEquipment(),
        this.#buildFeatures(),
      ]);
      this.#buildSkills();
      this.#buildSaves();
      this.#buildFavorHinder();
      this.#buildConditions();
      this.#buildLuck();
      this.#buildCombat();
      this.#buildUtility();
    }

    /* -------------------------------------------- */

    async #buildWeapons() {
      const showUnequipped = this.#getSetting("showUnequippedWeapons") ?? false;
      const weapons = (this.items ?? []).filter(i =>
        isWeapon(i) && (showUnequipped || isEquipped(i))
      );
      if (!weapons.length) return;

      const actions = weapons.map(item => {
        const equipped = isEquipped(item);
        const dmg = item.system?.currentDamage ?? item.system?.damageFormula ?? "";
        const range = item.system?.range ?? "";
        return {
          id:       item.id,
          name:     item.name,
          img:      coreModule.api.Utils.getImage(item),
          icon1:    equipped ? "<i class='fas fa-hand-fist' title='Equipped'></i>" : "",
          info1:    dmg   ? { text: dmg,   title: "Damage" } : null,
          info2:    range ? { text: range, title: "Range"  } : null,
          listName: item.name,
          system:   { actionType: "weapon", actionId: item.id }
        };
      });

      this.addActions(actions, { id: "weapons" });
    }

    /* -------------------------------------------- */

    async #buildSpells() {
      const spells = (this.items ?? []).filter(i => i.type === "spell");
      if (!spells.length) return;

      const actions = spells.map(item => {
        const manaCost = item.system?.manaCost ?? item.system?.castingManaCost ?? null;
        return {
          id:       item.id,
          name:     item.name,
          img:      coreModule.api.Utils.getImage(item),
          icon1:    "<i class='fas fa-wand-sparkles'></i>",
          info1:    manaCost !== null ? { text: String(manaCost), title: "Mana Cost" } : null,
          listName: item.name,
          system:   { actionType: "spell", actionId: item.id }
        };
      });

      this.addActions(actions, { id: "spells" });
    }

    /* -------------------------------------------- */

    async #buildPerks() {
      const perks = (this.items ?? []).filter(i => i.type === "perk");
      if (!perks.length) return;

      const actions = perks.map(item => ({
        id:       item.id,
        name:     item.name,
        img:      coreModule.api.Utils.getImage(item),
        listName: item.name,
        system:   { actionType: "perk", actionId: item.id }
      }));

      this.addActions(actions, { id: "perks" });
    }

    /* -------------------------------------------- */

    async #buildFeatures() {
      try {
      const actor = this.actor;
      const classItem    = actor.items.find(i => i.type === "class");
      const ancestryItem = actor.items.find(i => i.type === "ancestry");
      console.log("TAH | classItem:", classItem?.name, "features:", classItem?.system?.levelFeatures?.length);
      console.log("TAH | ancestryItem:", ancestryItem?.name, "traits:", ancestryItem?.system?.traits?.length);

      // Class features from levelFeatures array
      const featureActions = (classItem?.system?.levelFeatures ?? [])
        .filter(f => f?.name)
        .map((f, index) => ({
          id:       `class-feature-${index}`,
          name:     f.name,
          info1:    f.level ? { text: `Lvl ${f.level}`, title: "Level" } : null,
          listName: f.name,
          system:   { actionType: "classFeature", actionId: String(index) }
        }));

      // Ancestry traits from traits array
      const traitActions = (ancestryItem?.system?.traits ?? [])
        .filter(t => t?.name)
        .map((t, index) => ({
          id:       `ancestry-trait-${index}`,
          name:     t.name,
          listName: t.name,
          system:   { actionType: "ancestryTrait", actionId: String(index) }
        }));

      console.log("TAH | featureActions:", featureActions.length, "traitActions:", traitActions.length);
      if (featureActions.length) this.addActions(featureActions, { id: "features" });
      if (traitActions.length)   this.addActions(traitActions,   { id: "traits"   });
      console.log("TAH | addActions called for both");
      } catch(err) { console.error("TAH | buildFeatures error:", err); }
    }

    /* -------------------------------------------- */

    async #buildNPCActions() {
      const actions = Array.from(this.actor.system?.actions ?? []);
      if (!actions.length) return;

      const hudActions = actions
        .filter(a => a != null)
        .map((action, index) => {
          const dmg = action.rollDamage || action.flatDamage || "";
          const recharge = action.recharge ? `⟳${action.recharge}` : "";
          return {
            id:       `npc-action-${index}`,
            name:     action.name || `Action ${index + 1}`,
            info1:    dmg      ? { text: dmg,      title: "Damage"   } : null,
            info2:    recharge ? { text: recharge, title: "Recharge" } : null,
            listName: action.name,
            system:   { actionType: "npcAction", actionId: String(index) }
          };
        });

      this.addActions(hudActions, { id: "npc-actions" });
    }

    /* -------------------------------------------- */

    async #buildNPCAbilities() {
      const abilities = Array.from(this.actor.system?.abilities ?? []);
      if (!abilities.length) return;

      const hudActions = abilities
        .filter(a => a != null)
        .map((ability, index) => ({
          id:       `npc-ability-${index}`,
          name:     ability.name || `Ability ${index + 1}`,
          listName: ability.name,
          system:   { actionType: "npcAbility", actionId: String(index) }
        }));

      this.addActions(hudActions, { id: "npc-abilities" });
    }

    /* -------------------------------------------- */

    #buildFavorHinder() {
      const actor = this.actor;
      const current = actor?.system?.favorHinder ?? "none";
      const states = { none: { label: "No Modifier", icon: "fas fa-minus" }, favor: { label: "Favored", icon: "fas fa-arrow-up" }, hinder: { label: "Hindered", icon: "fas fa-arrow-down" } };
      const actions = Object.entries(states).map(([key, val]) => ({
        id:       `favor-hinder-${key}`,
        name:     val.label,
        icon1:    `<i class='${val.icon}'></i>`,
        cssClass: key === current ? "active" : "",
        listName: val.label,
        system:   { actionType: "utility", actionId: `setFavorHinder-${key}` }
      }));
      this.addActions(actions, { id: "favor-hinder" });
    }

    /* -------------------------------------------- */

    #buildConditions() {
      const actor = this.actor;
      const effects = CONFIG.statusEffects ?? [];
      console.log("TAH Vagabond | buildConditions, effects:", effects.length, "actor:", actor?.name);
      if (!effects.length) return;

      const activeIds = new Set(
        (actor?.effects ?? [])
          .filter(e => !e.disabled)
          .flatMap(e => Array.from(e.statuses ?? []))
      );

      const actions = effects.map(effect => {
        const isActive = activeIds.has(effect.id);
        return {
          id:       effect.id,
          name:     game.i18n.localize(effect.name ?? effect.label ?? effect.id),
          img:      effect.img ?? effect.icon,
          cssClass: isActive ? "active" : "",
          listName: game.i18n.localize(effect.name ?? effect.label ?? effect.id),
          system:   { actionType: "condition", actionId: effect.id }
        };
      });

      this.addActions(actions, { id: "conditions" });
    }

    /* -------------------------------------------- */

    #buildLuck() {
      const actor = this.actor;
      if (!actor) return;

      const current = actor.system?.currentLuck ?? 0;
      const max     = actor.system?.maxLuck ?? 0;

      const actions = [{
        id:       "spendLuck",
        name:     "Spend Luck",
        icon1:    "<i class='fas fa-clover'></i>",
        info1:    { text: `${current}/${max}`, title: "Luck Pool" },
        listName: "Spend Luck",
        system:   { actionType: "utility", actionId: "spendLuck" }
      }];

      if (current < max) {
        actions.push({
          id:       "gainLuck",
          name:     "Gain Luck",
          icon1:    "<i class='fas fa-clover'></i>",
          listName: "Gain Luck",
          system:   { actionType: "utility", actionId: "gainLuck" }
        });
      }

      this.addActions(actions, { id: "luck" });
    }

    /* -------------------------------------------- */

    async #buildEquipment() {
      const gear = (this.items ?? []).filter(i =>
        i.type === "equipment" && i.system?.equipmentType !== "weapon"
      );
      if (!gear.length) return;

      const actions = gear.map(item => {
        const qty = item.system?.quantity;
        return {
          id:       item.id,
          name:     item.name,
          img:      coreModule.api.Utils.getImage(item),
          info1:    (qty > 1) ? { text: String(qty), title: "Quantity" } : null,
          listName: item.name,
          system:   { actionType: "equipment", actionId: item.id }
        };
      });

      this.addActions(actions, { id: "equipment" });
    }

    /* -------------------------------------------- */

    #buildStats() {
      const actorStats = this.actor?.system?.stats ?? {};
      // Fall back to config keys if no actor
      const statKeys = Object.keys(actorStats).length
        ? Object.keys(actorStats)
        : Object.keys(CONFIG.VAGABOND?.stats ?? {
            might: 1, dexterity: 1, awareness: 1, reason: 1, presence: 1, luck: 1
          });

      const actions = statKeys.map(key => {
        const stat = actorStats[key];
        const label = game.i18n.localize(CONFIG.VAGABOND?.stats?.[key] ?? key);
        return {
          id:       `stat-${key}`,
          name:     label,
          info1:    this.actor ? { text: String(stat?.value ?? "—"), title: label } : null,
          listName: label,
          system:   { actionType: "stat", actionId: key }
        };
      });

      this.addActions(actions, { id: "stats" });
    }

    /* -------------------------------------------- */

    #buildSkills() {
      const actorSkills = this.actor?.system?.skills ?? {};
      const skillKeys = Object.keys(CONFIG.VAGABOND?.skills ?? {
        arcana: 1, craft: 1, medicine: 1, brawl: 1, finesse: 1, melee: 1, ranged: 1,
        sneak: 1, detect: 1, mysticism: 1, survival: 1, influence: 1, leadership: 1, performance: 1
      });

      const actions = skillKeys.map(key => {
        const skill = actorSkills[key] ?? {};
        const label = game.i18n.localize(CONFIG.VAGABOND?.skills?.[key] ?? key);
        return {
          id:       `skill-${key}`,
          name:     label,
          icon1:    skill.trained ? "<i class='fas fa-check-circle' title='Trained'></i>" : "",
          info1:    this.actor && skill.difficulty ? { text: String(skill.difficulty), title: "Difficulty" } : null,
          listName: label,
          system:   { actionType: "skill", actionId: key }
        };
      });

      this.addActions(actions, { id: "skills" });
    }

    /* -------------------------------------------- */

    #buildSaves() {
      const actorSaves = this.actor?.system?.saves ?? {};
      const saveKeys = Object.keys(CONFIG.VAGABOND?.saves ?? {
        reflex: 1, endure: 1, will: 1
      });

      const actions = saveKeys.map(key => {
        const save = actorSaves[key] ?? {};
        const label = game.i18n.localize(CONFIG.VAGABOND?.saves?.[key] ?? key);
        return {
          id:       `save-${key}`,
          name:     label,
          info1:    this.actor && save.difficulty ? { text: String(save.difficulty), title: "Difficulty" } : null,
          listName: label,
          system:   { actionType: "save", actionId: key }
        };
      });

      this.addActions(actions, { id: "saves" });
    }

    /* -------------------------------------------- */

    #buildCombat() {
      const actor = this.actor;
      const inCombat = !!game.combat?.combatants.find(c => c.actor === actor);
      if (!inCombat) return;

      const actions = [{
        id:       "endTurn",
        name:     coreModule.api.Utils.i18n("tokenActionHud.endTurn"),
        icon1:    "<i class='fas fa-step-forward'></i>",
        listName: "End Turn",
        system:   { actionType: "utility", actionId: "endTurn" }
      }];

      this.addActions(actions, { id: "combat" });
    }

    /* -------------------------------------------- */

    #buildUtility() {
      const actor = this.actor;
      const actions = [];

      if (actor?.longRest || actor?.rest) {
        actions.push({
          id:       "longRest",
          name:     "Long Rest",
          icon1:    "<i class='fas fa-bed'></i>",
          listName: "Long Rest",
          system:   { actionType: "utility", actionId: "longRest" }
        });
      }
      if (actor?.shortRest) {
        actions.push({
          id:       "shortRest",
          name:     "Short Rest",
          icon1:    "<i class='fas fa-mug-hot'></i>",
          listName: "Short Rest",
          system:   { actionType: "utility", actionId: "shortRest" }
        });
      }

      if (actions.length) this.addActions(actions, { id: "utility" });
    }

    /* -------------------------------------------- */

    #getSetting(key) {
      try { return game.settings.get(MODULE_ID, key); } catch { return null; }
    }

    #getValidActors() {
      return coreModule.api.Utils.getControlledTokens()
        .filter(t => t.actor).map(t => t.actor);
    }

    #getValidTokens() {
      return coreModule.api.Utils.getControlledTokens().filter(t => t.actor);
    }
  };
});

// ─── ROLL HANDLER ─────────────────────────────────────────────────────────────

let RollHandler = null;

Hooks.once("tokenActionHudCoreApiReady", async coreModule => {

  RollHandler = class VagabondRollHandler extends coreModule.api.RollHandler {

    /** @override */
    async handleActionClick(event) {
      const { actionType, actionId } = this.action.system;

      if (!this.actor) {
        for (const token of coreModule.api.Utils.getControlledTokens()) {
          await this.#handleAction(event, actionType, token.actor, token, actionId);
        }
      } else {
        await this.#handleAction(event, actionType, this.actor, this.token, actionId);
      }
    }

    /* -------------------------------------------- */

    async #handleAction(event, actionType, actor, token, actionId) {
      switch (actionType) {
        case "weapon":
          await this.#rollWeapon(event, actor, actionId); break;
        case "spell":
          await this.#useSpell(actor, actionId); break;
        case "classFeature":
          await this.#postClassFeature(actor, actionId); break;
        case "ancestryTrait":
          await this.#postAncestryTrait(actor, actionId); break;
        case "feature":
        case "perk":
        case "equipment":
          await this.#useItem(event, actor, actionId); break;
        case "stat":
          await this.#rollStat(event, actor, actionId); break;
        case "skill":
          await this.#rollSkill(event, actor, actionId); break;
        case "save":
          await this.#rollSave(event, actor, actionId); break;
        case "npcAction":
          await this.#postNPCAction(actor, actionId); break;
        case "npcAbility":
          await this.#postNPCAbility(actor, actionId); break;
        case "condition":
          await this.#toggleCondition(actor, token, actionId); break;
        case "utility":
          await this.#performUtility(event, actor, token, actionId); break;
      }
    }

    /* -------------------------------------------- */

    async #rollWeapon(event, actor, itemId) {
      const item = coreModule.api.Utils.getItem(actor, itemId);
      if (!item) return;

      if (this.isRenderItem()) { this.renderItem(actor, itemId); return; }

      try {
        const { VagabondChatCard } = globalThis.vagabond.utils;

        const targets = Array.from(game.user.targets).map(t => ({
          tokenId: t.id, sceneId: t.scene.id,
          actorId: t.actor?.id, actorName: t.name,
          actorImg: t.document.texture.src,
        }));

        const favorHinder = calcFavorHinder(actor, event);
        const attackResult = await item.rollAttack(actor, favorHinder);
        if (!attackResult) return;

        let damageRoll = null;
        if (shouldRollDamage(attackResult.isHit)) {
          damageRoll = await item.rollDamage(
            actor, attackResult.isCritical, attackResult.weaponSkill?.stat ?? null
          );
        }

        await VagabondChatCard.weaponAttack(actor, item, attackResult, damageRoll, targets);
        await item.handleConsumption();
      } catch (err) {
        console.error("TAH Vagabond | weapon roll failed:", err);
        ui.notifications.warn("Weapon roll failed — check console for details");
      }

      Hooks.callAll("forceUpdateTokenActionHud");
    }

    /* -------------------------------------------- */

    async #useSpell(actor, itemId) {
      if (this.isRenderItem()) { this.renderItem(actor, itemId); return; }
      const item = coreModule.api.Utils.getItem(actor, itemId);
      if (!item) return;
      await VagabondSpellDialog.show(actor, item);
    }

    /* -------------------------------------------- */

    async #useItem(event, actor, itemId) {
      const item = coreModule.api.Utils.getItem(actor, itemId);
      if (!item) return;

      if (this.isRenderItem()) { this.renderItem(actor, itemId); return; }

      try {
        await item.roll(event);
      } catch (err) {
        console.error("TAH Vagabond | item use failed:", err);
      }

      Hooks.callAll("forceUpdateTokenActionHud");
    }

    /* -------------------------------------------- */

    async #rollStat(event, actor, statKey) {
      try {
        const { VagabondRollBuilder } = await import("/systems/vagabond/module/helpers/roll-builder.mjs");
        const { VagabondChatCard }    = globalThis.vagabond.utils;

        const favorHinder = calcFavorHinder(actor, event);
        const roll = await VagabondRollBuilder.buildAndEvaluateD20(actor, favorHinder);

        const label = game.i18n.localize(CONFIG.VAGABOND?.stats?.[statKey] ?? statKey);
        await roll.toMessage({
          speaker:  ChatMessage.getSpeaker({ actor }),
          flavor:   label,
          rollMode: game.settings.get("core", "rollMode"),
        });

        if (actor.system.manualCheckBonus !== 0)
          await actor.update({ "system.manualCheckBonus": 0 });
      } catch (err) {
        console.warn("TAH Vagabond | stat roll fallback:", err.message);
        const roll = new Roll("1d20");
        await roll.evaluate();
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor:  game.i18n.localize(CONFIG.VAGABOND?.stats?.[statKey] ?? statKey)
        });
      }
    }

    /* -------------------------------------------- */

    async #rollSkill(event, actor, skillKey) {
      try {
        const { VagabondRollBuilder } = await import("/systems/vagabond/module/helpers/roll-builder.mjs");
        const { VagabondChatCard }    = globalThis.vagabond.utils;

        const favorHinder = calcFavorHinder(actor, event);
        const roll = await VagabondRollBuilder.buildAndEvaluateD20(actor, favorHinder);

        const skillData = actor.system.skills?.[skillKey];
        const difficulty = skillData?.difficulty ?? 10;
        const isSuccess  = roll.total >= difficulty;

        await VagabondChatCard.skillRoll(actor, skillKey, roll, difficulty, isSuccess);

        if (actor.system.manualCheckBonus !== 0)
          await actor.update({ "system.manualCheckBonus": 0 });
      } catch (err) {
        console.warn("TAH Vagabond | skill roll fallback:", err.message);
        const roll = new Roll("1d20");
        await roll.evaluate();
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor:  game.i18n.localize(CONFIG.VAGABOND?.skills?.[skillKey] ?? skillKey)
        });
      }
    }

    /* -------------------------------------------- */

    async #rollSave(event, actor, saveKey) {
      try {
        const { VagabondRollBuilder } = await import("/systems/vagabond/module/helpers/roll-builder.mjs");
        const { VagabondChatCard }    = globalThis.vagabond.utils;

        const favorHinder = calcFavorHinder(actor, event);
        const roll = await VagabondRollBuilder.buildAndEvaluateD20(actor, favorHinder);

        const saveData   = actor.system.saves?.[saveKey];
        const difficulty = saveData?.difficulty ?? 10;
        const isSuccess  = roll.total >= difficulty;

        await VagabondChatCard.saveRoll(actor, saveKey, roll, difficulty, isSuccess);

        if (actor.system.manualCheckBonus !== 0)
          await actor.update({ "system.manualCheckBonus": 0 });
      } catch (err) {
        console.warn("TAH Vagabond | save roll fallback:", err.message);
        const roll = new Roll("1d20");
        await roll.evaluate();
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor:  `${game.i18n.localize(CONFIG.VAGABOND?.saves?.[saveKey] ?? saveKey)} Save`
        });
      }
    }

    /* -------------------------------------------- */

    async #performUtility(event, actor, token, actionId) {
      switch (actionId) {
        case "initiative":
          if (actor) {
            await actor.rollInitiative({ createCombatants: true, rerollInitiative: true });
          }
          break;
        case "endTurn":
          if (token && game.combat?.current?.tokenId === token.id)
            await game.combat?.nextTurn();
          break;
        case "longRest":
          if (actor?.longRest) await actor.longRest();
          else if (actor?.rest) await actor.rest();
          break;
        case "shortRest":
          if (actor?.shortRest) await actor.shortRest();
          break;
        case "spendLuck":
          await this.#modifyLuck(actor, -1); break;
        case "gainLuck":
          await this.#modifyLuck(actor, +1); break;
        case "setFavorHinder-none":
          await actor.update({ "system.favorHinder": "none" }); break;
        case "setFavorHinder-favor":
          await actor.update({ "system.favorHinder": "favor" }); break;
        case "setFavorHinder-hinder":
          await actor.update({ "system.favorHinder": "hinder" }); break;
      }
      Hooks.callAll("forceUpdateTokenActionHud");
    }

    /* -------------------------------------------- */

    async #postClassFeature(actor, indexStr) {
      const index = parseInt(indexStr);
      const classItem = actor.items.find(i => i.type === "class");
      const feature = classItem?.system?.levelFeatures?.[index];
      if (!feature) return;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `<strong>${feature.name}</strong>${feature.level ? ` <em>(Level ${feature.level})</em>` : ""}`,
        content: feature.description || "",
      });
    }

    async #postAncestryTrait(actor, indexStr) {
      const index = parseInt(indexStr);
      const ancestryItem = actor.items.find(i => i.type === "ancestry");
      const trait = ancestryItem?.system?.traits?.[index];
      if (!trait) return;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `<strong>${trait.name}</strong>`,
        content: trait.description || "",
      });
    }

    async #postNPCAction(actor, indexStr) {
      const index = parseInt(indexStr);
      const action = actor.system?.actions?.[index];
      if (!action) return;

      const targets = Array.from(game.user.targets).map(t => ({
        tokenId: t.id, sceneId: t.scene.id,
        actorId: t.actor?.id, actorName: t.name, actorImg: t.document.texture.src,
      }));

      try {
        const { VagabondChatCard } = globalThis.vagabond.utils;
        await VagabondChatCard.npcAction(actor, action, index, targets);
      } catch(err) {
        console.error("TAH Vagabond | NPC action post failed:", err);
      }
      Hooks.callAll("forceUpdateTokenActionHud");
    }

    async #postNPCAbility(actor, indexStr) {
      const index = parseInt(indexStr);
      const ability = actor.system?.abilities?.[index];
      if (!ability) return;

      try {
        const { VagabondChatCard } = globalThis.vagabond.utils;
        // Abilities use npcAction under the hood (same chat card)
        await VagabondChatCard.npcAction(actor, ability, index);
      } catch(err) {
        console.error("TAH Vagabond | NPC ability post failed:", err);
      }
      Hooks.callAll("forceUpdateTokenActionHud");
    }

    async #toggleCondition(actor, token, conditionId) {
      if (!token) return;
      try {
        await actor.toggleStatusEffect(conditionId, { overlay: this.isRightClick });
      } catch(err) {
        console.error("TAH Vagabond | condition toggle failed:", err);
      }
      Hooks.callAll("forceUpdateTokenActionHud");
    }

    async #modifyLuck(actor, delta) {
      const current = actor.system?.currentLuck ?? 0;
      const max     = actor.system?.maxLuck ?? 0;
      const newLuck = Math.min(max, Math.max(0, current + delta));
      if (newLuck === current) return;
      await actor.update({ "system.currentLuck": newLuck });
      const { VagabondChatCard } = globalThis.vagabond.utils;
      if (delta < 0) await VagabondChatCard.luckSpend(actor, newLuck, max);
      else           await VagabondChatCard.luckGain(actor, newLuck, max);
      Hooks.callAll("forceUpdateTokenActionHud");
    }

    /* -------------------------------------------- */

    /** @override */
    async handleActionHover(event) {
      const { actionType, actionId } = this.action?.system ?? {};
      if (!this.actor || !actionId) return;

      const itemTypes = ["weapon", "spell", "perk", "equipment"];
      if (!itemTypes.includes(actionType)) return;

      const item = coreModule.api.Utils.getItem(this.actor, actionId);
      if (!item) return;

      if (this.isHover) Hooks.call("tokenActionHudSystemActionHoverOn",  event, item);
      else              Hooks.call("tokenActionHudSystemActionHoverOff", event, item);
    }
  };
});

// ─── SYSTEM MANAGER ───────────────────────────────────────────────────────────

let SystemManager = null;

Hooks.once("tokenActionHudCoreApiReady", async coreModule => {
  SystemManager = class VagabondSystemManager extends coreModule.api.SystemManager {

    /** @override */
    getActionHandler() {
      return new ActionHandler();
    }

    /** @override */
    getAvailableRollHandlers() {
      return { core: "Core Vagabond" };
    }

    /** @override */
    getRollHandler(rollHandlerId) {
      return new RollHandler();
    }

    /** @override */
    registerSettings(onChangeFunction) {
      game.settings.register(MODULE_ID, "showUnequippedWeapons", {
        name:   game.i18n.localize("tokenActionHud.vagabond.settings.showUnequippedWeapons.name"),
        hint:   game.i18n.localize("tokenActionHud.vagabond.settings.showUnequippedWeapons.hint"),
        scope:  "client",
        config: true,
        type:   Boolean,
        default: false,
        onChange: value => onChangeFunction(value)
      });
    }

    /** @override */
    async registerDefaults() {
      const defaults = buildDefaults(coreModule);
      console.log("TAH Vagabond | registerDefaults groups:", defaults.groups.map(g => g.id));
      return defaults;
    }
  };
});

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

Hooks.on("tokenActionHudCoreApiReady", async () => {
  const module = game.modules.get(MODULE_ID);
  module.api = {
    requiredCoreModuleVersion: REQUIRED_CORE_MODULE_VERSION,
    SystemManager
  };
  Hooks.call("tokenActionHudSystemReady", module);
});
