import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Pressable,
    ScrollView,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMutedUsers, toggleMuteUser } from "../../services/api";
import { useThemeColors } from "../../hooks/useThemeColors";

const ACCENT = "#7c5cfc";

type User = {
    id: number;
    username: string;
    profile_picture: string;
    isOnline: boolean;
    latest_message: string;
    latest_message_timestamp: string;
    unread_count: number;
};

interface MessagesTopBarProps {
    selectedUser: User | null;
    openVideoCall: () => void;
    onMuteToggle: () => void;
    onBack: () => void;
}

function SheetBtn({ icon, label, onPress, muted = false, colors }: { icon: React.ReactNode; label: string; onPress: () => void; muted?: boolean; colors: any }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sheetBtn}>
            <View style={[styles.sheetBtnIcon, { backgroundColor: colors.hover }]}>{icon}</View>
            <Text style={[styles.sheetBtnLabel, { color: muted ? colors.textDisabled : colors.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function SheetDivider({ colors }: { colors: any }) {
    return <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />;
}

const MessagesTopBar: React.FC<MessagesTopBarProps> = ({ selectedUser, openVideoCall, onMuteToggle, onBack }) => {
    const colors = useThemeColors();
    const router = useRouter();

    const [optionsOpen, setOptionsOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [muteLoading, setMuteLoading] = useState(false);

    useEffect(() => {
        if (!selectedUser) return;
        getMutedUsers()
            .then((ids) => setIsMuted(ids.includes(selectedUser.id)))
            .catch(console.error);
    }, [selectedUser?.id]);

    const handleToggleMute = async () => {
        if (!selectedUser || muteLoading) return;
        setMuteLoading(true);
        try {
            const result = await toggleMuteUser(selectedUser.id);
            setIsMuted(result.muted);
            onMuteToggle();
        } catch (e) { console.error(e); }
        finally { setMuteLoading(false); setOptionsOpen(false); }
    };

    return (
        <>
            <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {/* Back */}
                <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Avatar + name */}
                <TouchableOpacity
                    onPress={() => router.push(`/profile/${selectedUser?.id}`)}
                    style={styles.userInfo}
                    activeOpacity={0.8}
                >
                    <Image
                        source={
                            selectedUser?.profile_picture
                                ? { uri: selectedUser.profile_picture }
                                : require("../../assets/profile_blank.png")
                        }
                        style={[styles.avatar, { borderColor: colors.border }]}
                    />
                    <Text style={[styles.username, { color: colors.textPrimary }]} numberOfLines={1}>
                        {selectedUser?.username}
                    </Text>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity onPress={openVideoCall} style={styles.iconBtn} activeOpacity={0.7}>
                        <Ionicons name="videocam-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setOptionsOpen(true)} style={styles.iconBtn} activeOpacity={0.7}>
                        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Options modal */}
            <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOptionsOpen(false)}>
                    <Pressable>
                        <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <SheetBtn
                                icon={
                                    <Ionicons
                                        name={isMuted ? "notifications-outline" : "notifications-off-outline"}
                                        size={17}
                                        color={colors.textSecondary}
                                    />
                                }
                                label={muteLoading ? "Updating…" : isMuted ? `Unmute ${selectedUser?.username}` : `Mute ${selectedUser?.username}`}
                                onPress={handleToggleMute}
                                colors={colors}
                            />
                            <SheetDivider colors={colors} />
                            <SheetBtn
                                icon={<Ionicons name="close" size={17} color={colors.textDisabled} />}
                                label="Cancel"
                                onPress={() => setOptionsOpen(false)}
                                muted
                                colors={colors}
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
};

export default MessagesTopBar;

const styles = StyleSheet.create({
    bar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, borderBottomWidth: 1 },
    iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    userInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, marginLeft: 2 },
    avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5 },
    username: { fontWeight: "500", fontSize: 14.5, flex: 1 },
    actions: { flexDirection: "row", alignItems: "center" },

    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
    optionsCard: { width: 290, borderRadius: 18, borderWidth: 1, padding: 6 },
    sheetBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
    sheetBtnIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    sheetBtnLabel: { fontWeight: "500", fontSize: 14 },
    sheetDivider: { height: 1, marginHorizontal: 8, marginVertical: 4 },
});