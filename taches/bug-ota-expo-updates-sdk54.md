# Bug OTA (eas update) — crash natif sur activation bundle, SDK 54/55

## Statut : CAUSE RÉELLE IDENTIFIÉE — déjà résolue sur Momentum (voir solution en bas)

**Ce n'est PAS un bug générique expo-updates.** C'est un crash **PAC (Pointer Authentication) spécifique à Hermes sur iPhone 17 Pro Max + iOS 26**, lors de l'application d'un bundle OTA. Le bytecode Hermes précompilé viole l'enforcement PAC du matériel sur cette combinaison device/OS précise.

Confirmé identique sur le repo Momentum (`~/MOMENTUM/ATHLETE`, commit `96c948b`) :
> "Hermes prebuilt bytecode triggers a PAC enforcement crash on iPhone 17 Pro Max + iOS 26 when applying EAS Update OTA bundles. Confirmed via crash log: SIGABRT on expo.controller.errorRecoveryQueue."

Références externes (Hermes/RN/Expo) :
- https://github.com/facebook/hermes/issues/1966
- https://github.com/expo/expo/issues/44606
- https://github.com/facebook/react-native/issues/54859
- (issue plus générale, symptôme identique mais sans la cause PAC identifiée) https://github.com/expo/expo/issues/45772

## SOLUTION VALIDÉE (déjà appliquée sur Momentum) : switch jsEngine Hermes → JSC
```json
// app.json
"ios": {
  "jsEngine": "jsc"
}
```
- Plus de précompilation bytecode → plus de crash PAC.
- OTA fonctionne normalement sur tous les devices ensuite.
- Coût : ~10-15% de perte de perf JS (acceptable pour une app CRM/coaching, pas de calcul lourd).
- Nécessite un rebuild (native change) après le switch, puis les futurs `eas update` fonctionnent normalement.

## Ancien statut (avant d'avoir trouvé la vraie cause, gardé pour historique)
Avant de comparer avec Momentum, on pensait que c'était un bug non résolu côté Expo, indépendant de la config projet. Confirmé sur ClosRM mobile (Expo SDK 54, expo-updates 29.0.17).

## Symptôme
- `eas update` publie correctement (visible dans `eas update:list`, bon channel, bon runtimeVersion).
- L'app détecte l'update (`checkForUpdateAsync` → `isAvailable: true`), la télécharge (`NewUpdateLoaded`), mais **crash au moment d'activer le nouveau bundle** (au reload ou au prochain cold start).
- Après le crash, l'app **retombe silencieusement sur le bundle embarqué** (celui du dernier build) — pas d'erreur JS visible, pas de log console.
- L'update est ensuite marquée `failureCount = 1` côté device (visible dans le log `dev.expo.modules.core.logging.expo-updates.txt`) et **blacklistée définitivement** pour cet update ID : elle ne sera plus jamais retentée automatiquement, même après un nouveau check réussi.

## Cause racine confirmée
Bug connu et documenté : [expo/expo#45772](https://github.com/expo/expo/issues/45772)
> OTA updates crash on iOS at the bundle-activation step, uncaught `NSException` on la queue `expo.controller.errorRecoveryQueue`, pendant un appel `Data.write(to:options:)` interne au module.
> Reproduit à 100% sur `expo-updates@29.0.17` (SDK 54) et `expo-updates@55.0.22` (SDK 55).
> `disableAntiBrickingMeasures: true` **ne corrige pas** le crash (le write buggé n'est pas gated par l'anti-bricking).
> Pas de fix officiel connu à ce jour (issue ouverte, labellisée "incomplete / needs repro" par Expo).

## Comment on l'a confirmé (méthode de diagnostic, réutilisable)
1. Récupérer le crash log natif iOS directement via CLI, sans Xcode GUI :
   ```bash
   xcrun devicectl device info files --domain-type systemCrashLogs --device <UDID>
   xcrun devicectl device copy from --device <UDID> --domain-type systemCrashLogs \
     --source "NomApp-YYYY-MM-DD-HHMMSS.ips" --destination /tmp/crash.ips
   ```
   Chercher le thread `triggered: true` → queue `expo.controller.errorRecoveryQueue` → `EXC_CRASH/SIGABRT`.

2. Récupérer le log applicatif expo-updates (bien plus parlant que les Alert JS) :
   ```bash
   xcrun devicectl device copy from --device <UDID> --domain-type appDataContainer \
     --domain-identifier <bundleID> --source "Library" --destination /tmp/appdata
   cat "/tmp/appdata/Application Support/dev.expo.modules.core.logging.expo-updates.txt"
   ```
   Chercher `NewUpdateLoaded` (téléchargement OK) suivi de `Stored update found: ID = ..., failureCount = 1` (activation échouée + blacklist).

## Ce qui a été corrigé au passage (nécessaire mais pas suffisant)
Ces 3 causes cumulées empêchaient même de tester l'OTA proprement — corrigées avant de tomber sur le vrai bug SDK :
1. Plugin `expo-updates` absent de `app.json.plugins` → `Updates.isEnabled` restait `false`.
2. `eas build --local` ne grave PAS le channel/URL updates dans le natif (contrairement à un build cloud) → fix : déclarer `updates.requestHeaders.expo-channel-name` dans `app.json` + refaire un `expo prebuild` (grave dans `Expo.plist` même en local, sans consommer de quota EAS cloud).
3. Env vars (Supabase URL/key) absentes côté serveur EAS pour l'environnement `preview` → `eas env:create` nécessaire, sinon le bundle OTA embarque des clés vides et crash au boot pour une raison différente (mais donne aussi `updatePreviouslyFailed`).
4. `runtimeVersion` en `policy: "appVersion"` → passé en valeur fixe (`"1.0.0"`) pour éviter tout risque de désync natif/JS.

⚠️ Piège : un update publié **avant** un nouveau build est rejeté par la selection policy (`updateRejectedBySelectionPolicy`) car l'embedded est plus récent — toujours publier l'update APRÈS le build.

## Décision à prendre (en attente)
Appliquer la solution validée sur Momentum : ajouter `"jsEngine": "jsc"` dans `app.json.expo.ios`, rebuild, puis retester l'OTA. Pas encore fait sur ClosRM — à valider avec Pierre avant application (impact perf mineur, mais changement natif donc nécessite un nouveau build local pour tous les devices déjà installés).
