/**
 * La caméra de l'ajout (spec du 20/11, capture guidée) : un cadre guide sur
 * l'image, une phrase de bonne pratique, et des photos en rafale (une pièce
 * par photo) jusqu'à « Terminé ». Chaque photo part tout de suite
 * (`onPhoto`) : on prend la suivante pendant que la précédente se traite.
 *
 * expo-camera (dépendance accordée le 20/11). L'interface de la caméra est
 * toujours sombre, quel que soit le thème : c'est un viseur.
 */
import { useRef, useState } from 'react';
import { Linking, Modal, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './T';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { Button } from './Button';

const BLANC = '#FFFFFF';
const VOILE = 'rgba(0,0,0,0.45)';

type Props = {
  visible: boolean;
  /** Photos encore possibles dans cette série. */
  reste: number;
  onPhoto: (photo: { uri: string; largeur: number; hauteur: number }) => void;
  onFermer: () => void;
};

/** Les quatre coins du cadre guide. */
function Coins() {
  const coin = { position: 'absolute' as const, width: 34, height: 34, borderColor: BLANC };
  return (
    <>
      <View style={[coin, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 }]} />
      <View style={[coin, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 }]} />
      <View style={[coin, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 }]} />
      <View style={[coin, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 18 }]} />
    </>
  );
}

export function CameraCadre({ visible, reste, onPhoto, onFermer }: Props) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, demander] = useCameraPermissions();
  const [prises, setPrises] = useState(0);
  const [occupee, setOccupee] = useState(false);
  const restantes = Math.max(0, reste - prises);

  const declencher = async () => {
    if (!camera.current || occupee || restantes <= 0) return;
    setOccupee(true);
    try {
      const p = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      if (p?.uri) {
        setPrises((n) => n + 1);
        onPhoto({ uri: p.uri, largeur: p.width, hauteur: p.height });
      }
    } catch (err) {
      console.warn('[caméra] photo :', err instanceof Error ? err.message : String(err));
    } finally {
      setOccupee(false);
    }
  };

  const fermer = () => {
    setPrises(0);
    onFermer();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={fermer} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }} testID="camera-cadre">
        {!permission?.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <T v="title" style={{ color: BLANC, textAlign: 'center' }}>
              L’appareil photo
            </T>
            <T v="body" style={{ color: BLANC, textAlign: 'center', opacity: 0.8 }}>
              {permission && !permission.canAskAgain
                ? 'L’appareil photo est bloqué pour l’app. Autorise-le dans les Réglages de ton iPhone, puis reviens ici.'
                : 'Dresskode en a besoin pour photographier tes pièces, une à la fois.'}
            </T>
            <Button
              label={permission && !permission.canAskAgain ? 'Ouvrir les Réglages' : 'Autoriser'}
              onPress={() => (permission && !permission.canAskAgain ? Linking.openSettings() : demander())}
              testID="camera-autoriser"
            />
            <Button label="Fermer" variant="plain" onPress={fermer} testID="camera-fermer-refus" />
          </View>
        ) : (
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" animateShutter>
            <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                <View style={{ backgroundColor: VOILE, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <T v="small" style={{ color: BLANC, textAlign: 'center' }}>
                    Une pièce entière dans le cadre, à plat, sur un fond uni
                  </T>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                <View style={{ width: '78%', aspectRatio: 3 / 4 }} accessible accessibilityLabel="Cadre guide : place la pièce entière à l’intérieur">
                  <Coins />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
                <Tap
                  testID="camera-fermer"
                  onPress={fermer}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer l’appareil photo"
                  style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: VOILE, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="close" size={22} color={BLANC} flat />
                </Tap>
                <Tap
                  testID="camera-declencher"
                  onPress={declencher}
                  disabled={occupee || restantes <= 0}
                  accessibilityRole="button"
                  accessibilityLabel="Prendre la photo"
                  style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: BLANC, alignItems: 'center', justifyContent: 'center', opacity: restantes > 0 ? 1 : 0.4 }}
                >
                  <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: BLANC, opacity: occupee ? 0.6 : 1 }} />
                </Tap>
                <Tap
                  testID="camera-termine"
                  onPress={fermer}
                  accessibilityRole="button"
                  accessibilityLabel={prises ? `Terminé, ${prises} photo${prises > 1 ? 's' : ''}` : 'Terminé'}
                  style={{ minWidth: 56, height: 56, borderRadius: 28, paddingHorizontal: 14, backgroundColor: VOILE, alignItems: 'center', justifyContent: 'center' }}
                >
                  {prises ? (
                    <T v="label" style={{ color: BLANC }}>
                      {`OK · ${prises}`}
                    </T>
                  ) : (
                    <Icon name="check" size={22} color={BLANC} flat />
                  )}
                </Tap>
              </View>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}
