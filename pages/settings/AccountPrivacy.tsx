import React, { useState } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeColors } from "../../hooks/useThemeColors";
import { updatePrivacy } from "../../services/api";

const ACCENT = "#7c5cfc";

export default function AccountPrivacy() {
    const colors = useThemeColors();

    const [currentUser, setCurrentUser] = useState<any>(() => {
        return null; // loaded in useEffect below
    });
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) {
                const u = JSON.parse(raw);
                setCurrentUser(u);
                setIsPrivate(u.is_private ?? false);
            }
        });
    }, []);

    const handleToggle = async () => {
        const newVal = !isPrivate;
        setIsPrivate(newVal);
        setLoading(true);
        try {
            const res = await updatePrivacy(newVal);
            if (res.success) {
                const updated = { ...currentUser, is_private: newVal };
                setCurrentUser(updated);
                await AsyncStorage.setItem("user", JSON.stringify(updated));
            } else {
                setIsPrivate(!newVal);
            }
        } catch (e) {
            console.error(e);
            setIsPrivate(!newVal);
            Alert.alert("Error", "Failed to update privacy setting.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account privacy</Text>
                <Text style={[styles.sectionSub, { color: colors.textDisabled }]}>Control who can see your profile and content</Text>
            </View>

            {/* Privacy card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                        <Text style={styles.iconEmoji}>{isPrivate ? "🔒" : "🌐"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{isPrivate ? "Private account" : "Public account"}</Text>
                        <Text style={[styles.rowSub, { color: colors.textDisabled }]}>
                            {isPrivate ? "Only approved followers can see your posts" : "Anyone can view your profile and posts"}
                        </Text>
                    </View>
                    <View style={styles.switchWrap}>
                        {loading && <ActivityIndicator size="small" color={colors.textDisabled} style={{ marginRight: 6 }} />}
                        <Switch
                            value={isPrivate}
                            onValueChange={handleToggle}
                            disabled={loading}
                            trackColor={{ false: colors.border, true: ACCENT }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={[styles.footer, { backgroundColor: colors.hover, borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textDisabled }]}>
                        {isPrivate
                            ? "When private, only people you approve can follow you and see your content."
                            : "When public, anyone on the platform can view your profile, posts, and activity."}
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
    switchWrap: { flexDirection: "row", alignItems: "center", flexShrink: 0 },

    footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
    footerText: { fontSize: 12.5, lineHeight: 18 },
});