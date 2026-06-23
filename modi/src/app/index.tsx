import { StatusBar } from 'expo-status-bar';
import { AssemblyScreen } from '../components/AssemblyScreen';
import { FilamentTestScreen } from '../components/FilamentTestScreen';
import { AssemblyV2 } from '../components/AssemblyV2';

// Which screen to show:
//   'expo'      → original working expo-gl app
//   'filament'  → combined-GLB Filament screen (full UI, hierarchy issues)
//   'v2'        → rebuilt from individual standalone models (current work)
const SCREEN: 'expo' | 'filament' | 'v2' = 'v2';

export default function Index() {
  return (
    <>
      <StatusBar style="light" hidden />
      {SCREEN === 'expo' ? (
        <AssemblyScreen />
      ) : SCREEN === 'filament' ? (
        <FilamentTestScreen />
      ) : (
        <AssemblyV2 />
      )}
    </>
  );
}