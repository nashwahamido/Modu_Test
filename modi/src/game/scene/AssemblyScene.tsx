import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  EnvironmentalLight,
  FilamentView,
  Light,
  ModelRenderer,
  useCameraManipulator,
  useFilamentContext,
  useModel,
} from "react-native-filament";
import { useGameStore } from "@/game/core/store";
import { FOCAL_LENGTH_MM } from "./cameraConfig";
import { FILL_LIGHT, IBL_INTENSITY, KEY_LIGHT, RIM_LIGHT } from "./lighting";
import type { OffsetDriver } from "./offsetDriver";
import { PartModel } from "./PartModel";
import { ToolModel } from "./ToolModel";
import { SceneState } from "./useSceneState";

export type OrbitManipulator = ReturnType<typeof useCameraManipulator>;

// Soft blob shadow on the ground under the assembly. Defined here (not a
// separate file) so an incremental Metro refresh can't miss a new module.
const SHADOW_MODEL = require("../../assets/models/furniture-models/LACK/shadow.glb");
// Assembly floor (leg feet) is at pose y≈0; drop a hair below to avoid z-fight.
const SHADOW_FLOOR_Y = -0.004;

function ShadowPlane() {
  const model = useModel(SHADOW_MODEL);
  const { transformManager } = useFilamentContext();
  const worldShift = useGameStore((s) => s.worldShift);
  useEffect(() => {
    if (model.state !== "loaded") return;
    transformManager.setEntityPosition(
      model.rootEntity,
      [worldShift[0], SHADOW_FLOOR_Y + worldShift[1], worldShift[2]],
      false,
    );
  }, [model, transformManager, worldShift]);
  if (model.state !== "loaded") return null;
  return <ModelRenderer model={model} />;
}

interface Props {
  cameraManipulator: OrbitManipulator;
  sceneState: SceneState;
  heldDriver: OffsetDriver;
  sinkDriver: OffsetDriver;
}

/** The 3D workbench: camera, lights, and every part rendered by its game-state mode. */
export function AssemblyScene({
  cameraManipulator,
  sceneState,
  heldDriver,
  sinkDriver,
}: Props) {
  const furniture = useGameStore((s) => s.furniture);
  const style = useGameStore((s) => s.settings.style);
  // One combined GLB for the whole furniture. instanceCount=2: instance 0 is
  // the "world" copy parts live in (flush/loose/held); instance 1 is a free
  // ghost copy reused for socket hints, since a single mesh can't be in two
  // places (held + its empty socket) at once otherwise. The model is chosen by
  // the active visual style (falls back to the realistic default).
  const model = useModel(
    furniture?.styleModels?.[style] ?? furniture?.model ?? 0,
    { instanceCount: 2, addToScene: false },
  );

  const { modes, heldAction, activeTighten } = sceneState;

  // TEMP diagnostic: confirms the LACK model loads and its meshes resolve.
  useEffect(() => {
    console.log("[LACK] model.state =", model.state);
    if (model.state === "loaded") {
      try {
        const ents = model.asset.getInstance().getEntities();
        const top = model.asset.getFirstEntityByName("whole_tableTop");
        console.log("[LACK] entities:", ents.length, "| whole_tableTop found:", !!top);
      } catch (e) {
        console.log("[LACK] asset introspection error:", String(e));
      }
    }
  }, [model.state]);

  if (!furniture) return null;

  return (
    <View style={styles.filament}>
    <FilamentView style={styles.filament}>
      <Camera
        cameraManipulator={cameraManipulator}
        focalLengthInMillimeters={FOCAL_LENGTH_MM}
      />
      <EnvironmentalLight
        source={{ uri: "RNF_default_env_ibl.ktx" }}
        intensity={IBL_INTENSITY}
      />
      <Light
        type="directional"
        colorKelvin={KEY_LIGHT.colorKelvin}
        intensity={KEY_LIGHT.intensity}
        direction={KEY_LIGHT.direction}
        castShadows
      />
      <Light
        type="directional"
        colorKelvin={FILL_LIGHT.colorKelvin}
        intensity={FILL_LIGHT.intensity}
        direction={FILL_LIGHT.direction}
      />
      <Light
        type="directional"
        colorKelvin={RIM_LIGHT.colorKelvin}
        intensity={RIM_LIGHT.intensity}
        direction={RIM_LIGHT.direction}
      />
      {modes.tableTop === "flush" || modes.tableTop === "loose" ? (
        <ShadowPlane />
      ) : null}
      {Object.keys(furniture.parts).map((id) => (
        <PartModel
          key={id}
          def={furniture.parts[id]}
          mode={modes[id] ?? "hidden"}
          model={model}
          heldDriver={heldDriver}
          sinkDriver={sinkDriver}
          tightening={activeTighten?.partId === id}
          ghostAtLoosePose={heldAction?.type === "insertFastener"}
        />
      ))}
      {activeTighten?.tool && activeTighten.partId ? (
        <ToolModel key={activeTighten.actionId} action={activeTighten} />
      ) : null}
    </FilamentView>
    </View>
  );
}

const styles = StyleSheet.create({
  filament: { flex: 1 },
});