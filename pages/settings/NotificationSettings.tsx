import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAppNotifications } from "../../hooks/useNotifications";

const ACCENT = "#7c5cfc";

export default function NotificationsSettings() {
    const colors = useThemeColors();
    const { isMuted, setMuted } = useAppNotifications();

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
                <Text style={[styles.sectionSub, { color: colors.textDisabled }]}>Control how and when you receive alerts</Text>
            </View>

            {/* Mute card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                        <Text style={styles.iconEmoji}>{isMuted ? "🔕" : "🔔"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Mute all toasts</Text>
                        <Text style={[styles.rowSub, { color: colors.textDisabled }]}>
                            {isMuted ? "Toast notifications are silenced" : "Show pop-up toasts from all users"}
                        </Text>
                    </View>
                    <Switch
                        value={isMuted}
                        onValueChange={setMuted}
                        trackColor={{ false: colors.border, true: ACCENT }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={[styles.footer, { backgroundColor: colors.hover, borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textDisabled }]}>
                        When muted, no toast pop-ups will appear from any user's activity. This preference is saved locally on this device.
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