import { StatusBar } from 'expo-status-bar';
import { AssemblyScreen } from '../components/AssemblyScreen';

export default function Index() {
  return (
    <>
      <StatusBar style="light" hidden />
      <AssemblyScreen />
    </>
  );
}

