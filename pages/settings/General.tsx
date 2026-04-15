import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useGlobalStore } from "../../store/store";

const ACCENT = "#7c5cfc";

export default function General() {
    const colors = useThemeColors();
    const { user, setUser } = useGlobalStore();
    const isDark = user?.theme === "dark";

    const handleToggle = async () => {
        if (!user) return;
        const newTheme = isDark ? "light" : "dark";
        await setUser({ ...user, theme: newTheme });
    };

    return (
        <View style={styles.root}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>General</Text>
                <Text style={[styles.sectionSub, { color: colors.textDisabled }]}>Manage your app preferences</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                        <Text style={styles.iconEmoji}>{isDark ? "🌙" : "☀️"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                            {isDark ? "Dark mode" : "Light mode"}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.textDisabled }]}>
                            {isDark ? "Easy on the eyes in low light" : "Bright and clear for daytime use"}
                        </Text>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={handleToggle}
                        trackColor={{ false: colors.border, true: ACCENT }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={[styles.footer, { backgroundColor: colors.hover, borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textDisabled }]}>
                        Your theme preference is saved locally and applied across all sessions on this device.
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { gap: 16 },
    sectionHeader: { gap: 3 },
    sectionTitle: { fontWeight: "500", fontSize: 16, letterSpacing: -0.2 },
    sectionSub: { fontSize: 13 },
    card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    iconBox: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    iconEmoji: { fontSize: 17 },
    rowTitle: { fontWeight: "500", fontSize: 14, lineHeight: 20 },
    rowSub: { fontSize: 12.5, marginTop: 2 },
    footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
    footerText: { fontSize: 12.5, lineHeight: 18 },
});