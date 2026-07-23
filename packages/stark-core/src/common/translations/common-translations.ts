import { type TranslationObject } from "@ngx-translate/core";
import { translationsEn } from "./translations/en";
import { translationsFr } from "./translations/fr";
import { translationsNl } from "./translations/nl";

/**
 * Common translations for features available in Stark-Core package
 */
export const commonCoreTranslations: Record<string, TranslationObject> = {};
commonCoreTranslations["en"] = translationsEn;
commonCoreTranslations["fr"] = translationsFr;
commonCoreTranslations["nl"] = translationsNl;
