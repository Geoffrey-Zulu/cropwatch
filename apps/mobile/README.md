# Phytos mobile (Flutter)

The farmer and field-officer app. It lives in the repo but **outside the pnpm workspace**: it never imports TypeScript. Its only contract with the backend is the frozen REST v1 spec, [`packages/shared/src/contracts/openapi.json`](../../packages/shared/src/contracts/openapi.json) (version 1.0.0). Code against that file, not against server behaviour.

## Firebase setup

The Android app is already registered on Firebase project **`crop-watch01`**:

| Setting      | Value                                          |
| ------------ | ---------------------------------------------- |
| Package name | `zm.cropwatch.app`                             |
| App ID       | `1:24960589333:android:f2aa18f3d3659d29c4f81c` |

1. Set the Android `applicationId` to **`zm.cropwatch.app`** in `android/app/build.gradle(.kts)`. It must match, or Firebase refuses the config. (A different package means registering a new Firebase app; ask Geoffrey.)
2. Put `google-services.json` at **`apps/mobile/android/app/google-services.json`**. Any one of:
   - **FlutterFire CLI** (recommended; also writes `lib/firebase_options.dart`):
     `flutterfire configure --project=crop-watch01 --platforms=android --android-package-name=zm.cropwatch.app`
   - **Firebase CLI**:
     `firebase apps:sdkconfig ANDROID 1:24960589333:android:f2aa18f3d3659d29c4f81c --project crop-watch01 -o android/app/google-services.json`
   - **Console**: Firebase console → Project settings → Your apps → the Android app registered as "CropWatch Android" → download `google-services.json`.
3. Google sign-in (officers only) needs your debug SHA-1 on the app: `cd android && ./gradlew signingReport`, then add it in Project settings → the Android app registered as "CropWatch Android" → Add fingerprint. Anonymous sign-in for farmers needs nothing.

`google-services.json` and `firebase_options.dart` are public client config, like the web config: commit them with the Flutter project so every checkout builds.

## Backend

- **API base URL:** `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1`
- **Auth:** every call except `GET /health` sends `Authorization: Bearer <Firebase ID token>`. Farmers use **anonymous** sign-in; officers sign in with email/password or Google and get a `role` custom claim.
- **Region:** everything is in `europe-west1`. Default Storage bucket: `crop-watch01.firebasestorage.app`.

## Capture flow (Diagnose → Result)

1. Sign in anonymously (once; keep the user).
2. Generate the observation id **in the app**: `FirebaseFirestore.instance.collection('observations').doc().id` (or a UUID v4). It must match `^[A-Za-z0-9_-]{16,64}$`.
3. Upload each photo with the Firebase Storage SDK to **`observations/{uid}/{obs_id}/{n}.jpg`**, where `uid` is the signed-in user and `n` is 0, 1, 2… Content type `image/jpeg`, under 10 MB (resize to ~1600 px). Storage rules refuse any other uid, path, type or size, and refuse overwriting an existing photo.
4. `POST /observations` with the metadata and the photo paths (schema `CreateObservationRequest`). Retrying with the same `obs_id` is safe (200). The same `obs_id` from another user is a 403.
5. Show progress by **listening to the Firestore document `observations/{obs_id}`** (preferred), or poll `GET /observations/{id}`. Both carry the same field names. Render by `status`:
   - `diagnosing`: assessing the photo.
   - `awaiting_expert_review`: "An officer will review this" (no treatment advice).
   - `recommending`: diagnosis shown, advice on its way.
   - `complete`: diagnosis plus recommendation. In Firestore the recommendation lives in `recommendations/{recommendation_id}`; `GET /observations/{id}` embeds it.

## Rules the UI must follow

- **Never show a number for confidence or severity.** Show bands as words: "AI assessment: high confidence", "Severity: moderate". The contract has no numeric confidence anywhere, by design.
- **Unknown values are not errors.** Treat an unrecognised `status` as in-progress, an unrecognised issue as "unknown", and any other unrecognised enum value as generic. Ignore unknown fields. The contract only ever adds optional fields.
- **`label_dose` is verbatim label text.** Show it exactly as received. When `officer_referral` is true, show "Consult an extension officer for chemical options".
- **`sim: true` means demo data.** Show the "DEMO DATA · SIMULATED" badge on anything with it.
- **Alerts:** subscribe to FCM topic `alerts-{district_slug}` (take `district_slug` from the API, e.g. `alerts-chongwe`). The push data payload is `AlertPushData`. Always show an alert's level together with its contributing factors.
