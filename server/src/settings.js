import { readFileSync } from "node:fs";
import { CheckDeckOverride } from "../../shared/game/deck.js";

// reads serverSettings.json next to this module
function ReadSettingsFile()
{
  return readFileSync(new URL("./serverSettings.json", import.meta.url), "utf8");
}

// loads the test settings; a missing file or invalid JSON gives {} (the latter with a warning)
export function LoadServerSettings(ReadText = ReadSettingsFile, Warn = console.warn)
{
  try
  {
    const parsed = JSON.parse(ReadText());
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  }
  catch (err)
  {
    if (err?.code !== "ENOENT")
    {
      Warn(`serverSettings.json ignored: ${err.message}`);
    }
    return {};
  }
}

// returns the injected deck (card objects in deal order), or null when overrideDeck is unset
// or invalid; an invalid deck is warned about so the server falls back to shuffling
export function ResolveOverrideDeck(settings, byName, Warn = console.warn)
{
  const names = settings?.overrideDeck;
  if (names === undefined || names === null)
  {
    return null;
  }
  const check = CheckDeckOverride(names, byName);
  if (!check.ok)
  {
    Warn(`overrideDeck ignored (${check.reason}); shuffling normally`);
    return null;
  }
  return check.deck;
}
