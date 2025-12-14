const MODULE_ID = "sync-token-actor";
const I18N_PREFIX = "SYNC_TOKEN";

const SETTINGS = {
  autoNameSync: "autoNameSync",
  syncSceneTokens: "syncSceneTokens",
  autoImageSync: "autoImageSync",
  disableTokenRing: "disableTokenRing",
  panelEnabled: "panelEnabled",
  panelPosition: "panelPosition"
};

const FLAGS = {
  alwaysSync: "alwaysSync"
};

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  Hooks.on("updateActor", handleActorUpdate);
  Hooks.on("preCreateToken", handleTokenPreCreate);
  Hooks.on("renderActorSheet", injectSyncPanel);
});

function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.autoNameSync, {
    name: localize("Settings.autoNameSync.name"),
    hint: localize("Settings.autoNameSync.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.syncSceneTokens, {
    name: localize("Settings.syncSceneTokens.name"),
    hint: localize("Settings.syncSceneTokens.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.autoImageSync, {
    name: localize("Settings.autoImageSync.name"),
    hint: localize("Settings.autoImageSync.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.disableTokenRing, {
    name: localize("Settings.disableTokenRing.name"),
    hint: localize("Settings.disableTokenRing.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.panelEnabled, {
    name: localize("Settings.panelEnabled.name"),
    hint: localize("Settings.panelEnabled.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.panelPosition, {
    name: localize("Settings.panelPosition.name"),
    hint: localize("Settings.panelPosition.hint"),
    scope: "client",
    config: true,
    type: String,
    default: "bottom-left",
    choices: {
      "bottom-left": localize("Settings.panelPosition.options.bottomLeft"),
      "bottom-right": localize("Settings.panelPosition.options.bottomRight"),
      "top-right": localize("Settings.panelPosition.options.topRight"),
      "top-left": localize("Settings.panelPosition.options.topLeft")
    }
  });
}

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

function handleActorUpdate(actor, changes, options, userId) {
  if (!game.user || userId !== game.user.id) return;
  if (!actor || !actor.prototypeToken) return;
  if (!actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return;
  const forceSync = shouldForceSync(actor);

  if (actor.isToken && actor.token) {
    mirrorChangesToUnlinkedToken(actor, changes);
  }

  if ((getSetting(SETTINGS.autoNameSync) || forceSync) && typeof changes.name === "string") {
    syncPrototypeName(actor, changes.name).catch((err) => console.error(`${MODULE_ID} | name sync failed`, err));
  }

  if ((getSetting(SETTINGS.autoImageSync) || forceSync) && typeof changes.img === "string") {
    syncPrototypeImage(actor, changes.img).catch((err) => console.error(`${MODULE_ID} | image sync failed`, err));
  }
}

async function syncPrototypeName(actor, newName) {
  const updates = {};
  const prototypeName = foundry.utils.getProperty(actor.prototypeToken, "name");
  if (prototypeName !== newName) {
    updates["prototypeToken.name"] = newName;
  }

  if (!foundry.utils.isEmpty(updates)) {
    await actor.update(updates);
  }

  await updateTokensOnCanvas(actor, { name: newName });
}

async function syncPrototypeImage(actor, img) {
  const prototypeImg = foundry.utils.getProperty(actor.prototypeToken, "texture.src");
  const disableRing = getSetting(SETTINGS.disableTokenRing) || shouldForceSync(actor);
  if (prototypeImg === img && !disableRing) return;

  const actorUpdates = {};
  if (prototypeImg !== img) {
    actorUpdates["prototypeToken.texture.src"] = img;
  }
  if (disableRing) {
    actorUpdates["prototypeToken.ring.enabled"] = false;
  }

  if (!foundry.utils.isEmpty(actorUpdates)) {
    await actor.update(actorUpdates);
  }

  const tokenChanges = {};
  if (prototypeImg !== img) tokenChanges["texture.src"] = img;
  if (disableRing) tokenChanges["ring.enabled"] = false;
  if (!foundry.utils.isEmpty(tokenChanges)) {
    await updateTokensOnCanvas(actor, tokenChanges);
  }
}

async function updateTokensOnCanvas(actor, changes) {
  if (!getSetting(SETTINGS.syncSceneTokens)) return;
  if (!canvas?.scene) return;

  const updates = [];
  for (const token of canvas.tokens.placeables) {
    if (!token || !token.document) continue;
    if (!token.actor || token.actor.id !== actor.id) continue;
    if (!token.document.isOwner) continue;
    updates.push({ _id: token.id, ...changes });
  }

  if (!updates.length) return;

  return canvas.scene.updateEmbeddedDocuments("Token", updates).catch((err) => {
    console.error(`${MODULE_ID} | Token update failed`, err);
  });
}

function handleTokenPreCreate(tokenDocument, data, options, userId) {
  const actorId = tokenDocument.actorId;
  const actor = game.actors?.get(actorId);
  if (!actor) return;
  const forceSync = shouldForceSync(actor);
  if (!forceSync && !getSetting(SETTINGS.autoImageSync) && !getSetting(SETTINGS.autoNameSync)) return;

  if (forceSync || getSetting(SETTINGS.autoNameSync)) {
    tokenDocument.updateSource({ name: actor.name });
  }

  if (forceSync || getSetting(SETTINGS.autoImageSync)) {
    const texture = foundry.utils.duplicate(tokenDocument.texture ?? {});
    texture.src = actor.img;
    tokenDocument.updateSource({ texture });
  }

  if (getSetting(SETTINGS.disableTokenRing) || forceSync) {
    const ring = foundry.utils.duplicate(tokenDocument.ring ?? {});
    ring.enabled = false;
    tokenDocument.updateSource({ ring });
  }
}

function mirrorChangesToUnlinkedToken(actor, changes) {
  const tokenId = actor.token?.id;
  const tokenDocument = canvas?.tokens?.get(tokenId)?.document;
  if (!tokenDocument) return;

  const tokenUpdates = {};
  if (typeof changes.name === "string" && tokenDocument.name !== changes.name) {
    tokenUpdates.name = changes.name;
  }

  if (typeof changes.img === "string" && tokenDocument.texture?.src !== changes.img) {
    tokenUpdates["texture.src"] = changes.img;
  }

  if (!foundry.utils.isEmpty(tokenUpdates)) {
    tokenDocument.update(tokenUpdates).catch((err) => console.error(`${MODULE_ID} | token mirror failed`, err));
  }
}

function injectSyncPanel(sheet, html) {
  if (!getSetting(SETTINGS.panelEnabled)) return;
  const actor = sheet.actor ?? sheet.object;
  if (!actor || !actor.prototypeToken) return;
  const forceSync = shouldForceSync(actor);

  let profile = html.find('[data-edit="img"]').first();
  if (profile.length) {
    const container = profile.closest(".profile, .portrait, .image-container");
    profile = container.length ? container : profile.parent();
  } else {
    profile = html.find(".profile, .portrait, .image-container").first();
  }
  if (!profile || !profile.length) return;

  if (profile.css("position") === "static") {
    profile.css("position", "relative");
  }
  profile.addClass("sync-token-profile");
  profile.find(".sync-token-panel").remove();

  const tokenImg = actor.prototypeToken.texture?.src || CONST.DEFAULT_TOKEN;
  const sameImage = actor.img === tokenImg;

  const panel = $(`
    <div class="sync-token-panel ${getSetting(SETTINGS.panelPosition)} ${sameImage ? "" : "has-diff"} ${forceSync ? "force-sync" : ""}">
      <div class="st-images">
        <img class="token" src="${tokenImg}" title="${localize("Panel.tokenImage")}" />
      </div>
      <div class="st-actions">
        <button type="button" data-action="sync-image" title="${localize("Panel.syncImage")}">
          <i class="fas fa-sync-alt"></i>
        </button>
        <button type="button" data-action="toggle-force" title="${localize("Panel.toggleForce")}">
          <i class="fas fa-link"></i>
        </button>
      </div>
    </div>
  `);

  panel.find("img.token").on("click", () => openTokenConfig(actor));

  panel.find('[data-action="sync-image"]').on("click", async (event) => {
    event.preventDefault();
    await syncPrototypeImage(actor, actor.img);
    ui.notifications?.info(localize("Panel.syncDone"));
    sheet.render(false);
  });

  panel.find('[data-action="toggle-force"]').on("click", async (event) => {
    event.preventDefault();
    const current = shouldForceSync(actor);
    await setActorFlag(actor, FLAGS.alwaysSync, !current);
    ui.notifications?.info(localize(!current ? "Panel.forceOn" : "Panel.forceOff"));
    sheet.render(false);
  });

  profile.append(panel);
}

function openTokenConfig(actor) {
  const proto = actor?.prototypeToken;
  if (!proto) return;
  const sheet = proto.sheet;
  if (!sheet) return;
  sheet.render(true, { focus: true });
}

function shouldForceSync(actor) {
  return getActorFlag(actor, FLAGS.alwaysSync) ?? false;
}

function getActorFlag(actor, key) {
  try {
    return actor.getFlag(MODULE_ID, key);
  } catch (err) {
    const fallback = foundry.utils.getProperty(actor.flags ?? {}, `${MODULE_ID}.${key}`);
    if (fallback !== undefined) return fallback;
    console.warn(`${MODULE_ID} | Failed to read flag ${key}. Ensure the module is active.`, err);
    return fallback;
  }
}

async function setActorFlag(actor, key, value) {
  try {
    return await actor.setFlag(MODULE_ID, key, value);
  } catch (err) {
    console.warn(`${MODULE_ID} | setFlag failed, falling back to direct update.`, err);
    const update = {};
    update[`flags.${MODULE_ID}.${key}`] = value;
    return actor.update(update);
  }
}
