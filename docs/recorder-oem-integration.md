# The Autonomous Recorder — OEM Integration Spec

> **Audience:** the device manufacturer (ODM) and The Autonomous engineering.
> **Goal:** every recording made on the device flows automatically and securely
> into The Autonomous, where it becomes company memory. The device captures and
> delivers audio; **all intelligence — transcription, the knowledge graph, and
> agent recall — lives in The Autonomous.**

---

## 1. The one thing to build: deliver the audio to us

The single highest-value integration is **automatic egress of the raw recording
to a webhook we provide** — ideally without routing the audio through any
third-party AI cloud first.

```
  ┌─────────────┐   finalized recording    ┌──────────────────────────────┐
  │  Recorder   │ ───────────────────────► │  The Autonomous ingest API   │
  │  + app/     │   POST audio + metadata   │  → Deepgram transcription    │
  │  cloud      │   (HTTPS + API key)       │  → Claude entity extraction  │
  └─────────────┘                           │  → company knowledge graph   │
                                            └──────────────────────────────┘
```

We do **not** need the device app's transcript, summary, or mind-map, and we do
**not** care which LLM the app uses. We consume the audio and run our own
pipeline. (So "switch the app to Claude" is not required for this integration.)

---

## 2. Webhook contract

On each finalized recording, POST to the URL we provide.

**Endpoint (we issue the host + key):**
```
POST https://<app-host>/api/recorder/ingest
X-TA-Api-Key: <key we issue per workspace>
Content-Type: multipart/form-data
```

**Form fields:**

| Field          | Required | Notes |
|----------------|----------|-------|
| `audio`        | yes      | The raw audio file (the recording itself). |
| `recordingId`  | yes      | Stable unique id for this recording. Used for de-duplication — re-delivering the same `recordingId` is a no-op. |
| `deviceId`     | yes      | Serial / device identifier. |
| `startedAt`    | yes      | ISO-8601 timestamp the recording began. |
| `durationSec`  | no       | Length in seconds. |
| `language`     | no       | BCP-47 hint (e.g. `en`, `hi`). We auto-detect if absent. |
| `speakerCount` | no       | If known, helps speaker labelling. |
| `title`        | no       | Label, if the user set one. |

**Response:** `200 { "conversationId": "...", "status": "accepted" }`

**Reliability:**
- **Idempotent** on `recordingId` — safe to retry.
- Retry on `5xx` / network error with exponential backoff (e.g. 1m, 5m, 30m).
- Queue locally if offline; deliver when connectivity returns.

**Alternative (if direct file POST is hard):** send JSON
`{ recordingId, deviceId, startedAt, audioUrl }` where `audioUrl` is a
short-lived signed link we can fetch within ~15 minutes. Same auth + idempotency.

---

## 3. Audio requirements (this drives graph quality)

The accuracy of "who decided what, who committed to what" depends on the audio,
not the LLM. In priority order:

1. **Raw audio, not pre-summarised.** Send the recording, not the app's summary.
2. **Speaker separation (diarization).** A transcript that labels speakers is
   dramatically more useful — our extractor links commitments and decisions to
   people. If the device/app can output diarized audio or per-speaker channels,
   that is the biggest quality lever available.
3. **Prefer lossless/high-bitrate where possible.** MP3 is acceptable and works
   today; WAV/FLAC or multi-channel mic-array raw audio is better for noisy,
   multi-person rooms.
4. **Don't pre-route through a third-party AI cloud.** For a privacy-clean
   product, the audio should reach The Autonomous directly. (Avoids a
   TA-branded device shipping customer meeting audio to an external AI vendor.)

---

## 4. What we do NOT need

- The app's transcript, summary, mind-map, or task list.
- The app's choice of LLM (ChatGPT / Claude / other) — irrelevant to us.
- Any on-device NLP. Keep the device focused on capture + reliable delivery.

---

## 5. Security & privacy

- Transport: HTTPS/TLS only.
- Auth: a per-workspace API key in `X-TA-Api-Key` (we issue and rotate it).
  **Not** a shared global secret.
- Data handling: audio is processed by The Autonomous; if it transits the OEM
  cloud, we will want a data-processing agreement and a defined retention +
  deletion window. Preference is for audio to bypass the OEM cloud entirely.
- Scope the key to ingestion only.

---

## 6. Fallback that needs no firmware change (available today)

If the device/app can't POST to a webhook yet, we already support a manual path
with zero OEM work:

1. User pulls recordings off via USB-C, or the companion app auto-transfers them
   to a folder.
2. `scripts/import-recordings.ts` watches that folder and drains every file
   through the same pipeline (idempotent on filename):
   ```bash
   bun run scripts/import-recordings.ts <companyId> <folder> --watch --archive
   ```

Use this for pilots now; move to the webhook (§2) for a hands-off fleet.

---

## 7. The Autonomous-side implementation notes (internal)

**Built and live.** The endpoint and key mechanism in §2 exist:

- **Endpoint:** `src/app/api/recorder/ingest/route.ts` — accepts multipart
  `audio` bytes or JSON `audioUrl`, authenticated by `X-TA-Api-Key`. Auth runs
  first (bad/missing key → 401, learns nothing about our config). Idempotent on
  `(company, source="recorder", recordingId)` — re-delivery returns
  `200 {status:"duplicate"}`. `maxDuration = 300`.
- **Keys:** `recorder_api_keys` table (`migrations/012_recorder_keys.sql`),
  scoped per workspace; only the SHA-256 hash is stored. Lib:
  `src/lib/recorder-keys.ts`. Mint/list/revoke via
  `bun run scripts/recorder-key.ts create <companyId> [label]` — the raw key is
  shown once; hand it to the OEM. **Not** the `INTERNAL_SECRET`.
- **Pipeline:** audio → `transcribeAudioFromBuffer`/`transcribeAudioFromUrl`
  (`src/lib/deepgram.ts`) → `ingestConversation` (`src/lib/entity-extractor.ts`)
  with `source: "recorder"`, `sourceRef: <recordingId>`, `visibility: "company"`;
  dedup via `existingConversationSourceRefs`.
- **Reads:** recorder captures land in the company lane, so agents see them via
  `helpers.memory.recall()` (no viewer → company-only) and humans see them in
  `/admin/memory`.

**Remaining (optional):** apply `migrations/012` to the live DB; a small admin-UI
surface to mint/revoke keys (the CLI covers it for now); add per-key rate limits.
