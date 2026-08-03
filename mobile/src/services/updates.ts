import * as Updates from 'expo-updates'

/** Check + apply OTA updates au boot de l'app — force le reload si une
 *  nouvelle version est disponible, au lieu d'attendre 2 cycles
 *  open/close. Pas de UX perte : l'app est déjà en train de bootloader.
 *
 *  Si pas d'update ou erreur réseau : silent (pas de blocage).
 *  Skip en dev (Updates pas effectif). */
export async function checkAndApplyUpdate(): Promise<void> {
  // Skip si on est dans le client Expo (dev) ou en debug.
  if (__DEV__) return
  if (!Updates.isEnabled) return

  try {
    const result = await Updates.checkForUpdateAsync()
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync()
      // reloadAsync() relance l'app avec le nouveau bundle.
      await Updates.reloadAsync()
    }
  } catch (error) {
    // Pas d'update appliquée, on continue avec le bundle actuel — mais on
    // logue pour pouvoir diagnostiquer (cf. env vars manquantes du bundle
    // OTA qui ont fait crash l'app en silence : toujours publier avec
    // `eas update --environment preview`, jamais sans --environment).
    console.warn('[updates] checkAndApplyUpdate failed:', error)
  }
}
