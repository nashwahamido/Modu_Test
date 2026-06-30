import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Settings panel. The Focus / Hints / Auto-View accessibility toggles now live
 * as on-screen chips (bottom-right of the game screen); this panel is reserved
 * for the additional settings coming next.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.panel}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.placeholder}>More options coming soon.</Text>
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
  placeholder: {
    fontSize: 13,
    color: "#7a7163",
    paddingVertical: 8,
  },
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