# Inworld Mini Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utiliser dans Spec Refiner la voix Inworld de Videogen avec le modèle `inworld-tts-1.5-mini`.

**Architecture:** Extraire le contrat de requête Inworld dans un module TypeScript pur.
L'Edge Function consomme ce module sans modifier son contrat HTTP, son authentification ni ses garde-fous.

**Tech Stack:** Supabase Edge Functions, Deno TypeScript, Vitest, Bun.

## Global Constraints

La voix est `default-o-lizv8yves-5uhgzcrjog__ok`.

Le modèle est `inworld-tts-1.5-mini`.

Le débit est `0.8`.

La température est `1.0`.

Le secret `INWORLD_API_KEY` reste côté serveur.

Le déploiement de production nécessite une validation explicite.

---

### Task 1: Verrouiller et appliquer le contrat TTS

**Files:**

- Create: `supabase/functions/inworld/config.ts`
- Create: `supabase/functions/inworld/config.test.ts`
- Modify: `supabase/functions/inworld/index.ts`
- Modify: `AGENTS.md`
- Create: `docs/superpowers/specs/2026-07-29-inworld-mini-voice-design.md`
- Create: `docs/superpowers/plans/2026-07-29-inworld-mini-voice.md`

**Interfaces:**

- Consumes: le texte validé et nettoyé par `supabase/functions/inworld/index.ts`.
- Produces: `buildInworldRequestBody(text: string): InworldRequestBody`.

- [ ] **Step 1: Écrire le test de contrat en échec**

```ts
import { describe, expect, it } from "vitest";
import { buildInworldRequestBody } from "./config.ts";

describe("buildInworldRequestBody", () => {
  it("utilise la voix Videogen avec Inworld 1.5 Mini", () => {
    expect(buildInworldRequestBody("Bonjour")).toEqual({
      text: "Bonjour",
      voiceId: "default-o-lizv8yves-5uhgzcrjog__ok",
      modelId: "inworld-tts-1.5-mini",
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.8,
      },
      temperature: 1.0,
    });
  });
});
```

- [ ] **Step 2: Exécuter le test et constater l'échec**

Run: `bun x vitest run supabase/functions/inworld/config.test.ts`

Expected: FAIL car `config.ts` n'existe pas.

- [ ] **Step 3: Créer le constructeur minimal**

```ts
export interface InworldRequestBody {
  text: string;
  voiceId: string;
  modelId: string;
  audioConfig: {
    audioEncoding: "MP3";
    speakingRate: number;
  };
  temperature: number;
}

const VOICE_ID = "default-o-lizv8yves-5uhgzcrjog__ok";
const MODEL_ID = "inworld-tts-1.5-mini";
const SPEAKING_RATE = 0.8;
const TEMPERATURE = 1.0;

export function buildInworldRequestBody(text: string): InworldRequestBody {
  return {
    text,
    voiceId: VOICE_ID,
    modelId: MODEL_ID,
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: SPEAKING_RATE,
    },
    temperature: TEMPERATURE,
  };
}
```

- [ ] **Step 4: Brancher l'Edge Function sur le constructeur**

Importer `buildInworldRequestBody` depuis `./config.ts`.

Remplacer le corps JSON Inworld en ligne par `JSON.stringify(buildInworldRequestBody(text.slice(0, MAX_TEXT_LEN)))`.

- [ ] **Step 5: Exécuter le test ciblé**

Run: `bun x vitest run supabase/functions/inworld/config.test.ts`

Expected: PASS avec un test réussi.

- [ ] **Step 6: Exécuter toutes les validations**

Run: `bun run test`

Expected: toutes les suites réussissent.

Run: `bun run lint`

Expected: zéro erreur et zéro avertissement.

Run: `bun run build`

Expected: build Vite réussi.

- [ ] **Step 7: Vérifier le diff et committer**

Run: `git diff --check`

Expected: aucune erreur.

Run: `git status --short`

Expected: uniquement les six fichiers prévus.

Stage explicitement les six fichiers prévus.

Commit: `fix(tts): utiliser la voix Inworld Mini de Videogen`

- [ ] **Step 8: Préparer la livraison sans déployer**

Pousser la branche `codex/tts-inworld-mini`.

Ne pas fusionner dans `main` et ne pas déployer l'Edge Function sans validation explicite de Phil.
