import { type TranslationObject } from "@ngx-translate/core";
import { translationsEn } from "./translations/en";
import { translationsFr } from "./translations/fr";
import { translationsNl } from "./translations/nl";

/**
 * Common translations for features available in Stark-Ui package
 */
export const commonUiTranslations: Record<string, TranslationObject> = {};
commonUiTranslations["en"] = translationsEn;
commonUiTranslations["fr"] = translationsFr;
commonUiTranslations["nl"] = translationsNl;
