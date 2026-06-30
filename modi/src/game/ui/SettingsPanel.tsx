import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useGameStore } from "@/game/core/store";

function Row({
  label,
  desc,
  value,
  onValueChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#c9c2b4", true: "#6f8a68" }}
        thumbColor="#fff"
      />
    </View>
  );
}

/**
 * Settings panel. The Focus / Hints / Auto-View accessibility toggles live as
 * on-screen chips; this panel holds display + other settings.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.panel}>
        <Text style={styles.title}>Settings</Text>
        <Row
          label="Dark mode"
          desc="Use the dark background theme"
          value={settings.darkMode}
          onValueChange={(v) => setSettings({ darkMode: v })}
        />
        <Pressable style={styles.done} onPress={onClose} hitSlop={8}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,18,15,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: 320,
    maxWidth: "86%",
    backgroundColor: "#f7f3ea",
    borderRadius: 18,
    padding: 18,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2e2a24",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(60,50,40,0.08)",
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: "700", color: "#2e2a24" },
  rowDesc: { fontSize: 12, color: "#7a7163", marginTop: 2 },
  done: {
    marginTop: 12,
    alignSelf: "flex-end",
    backgroundColor: "#6f8a68",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});