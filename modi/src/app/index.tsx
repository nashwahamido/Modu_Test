import { StatusBar } from 'expo-status-bar';
import { AssemblyScreen } from '../components/AssemblyScreen';
import { FilamentTestScreen } from '../components/FilamentTestScreen';

// MIGRATION FLAG — flip to true to preview the Filament version.
// The working expo-gl app stays fully intact when this is false.
const USE_FILAMENT = true;

export default function Index() {
  return (
    <>
      <StatusBar style="light" hidden />
      {USE_FILAMENT ? <FilamentTestScreen /> : <AssemblyScreen />}
    </>
  );
}