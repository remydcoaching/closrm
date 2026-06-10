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
  } catch {
    // Silent — pas d'update appliquée, on continue avec le bundle actuel.
  }
}
