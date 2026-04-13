import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Pressable,
    Image,
    Alert,
    Clipboard,
} from "react-native";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { unfollowUser } from "../services/api";
import socket from "../services/socket";

const ACCENT = "#7c5cfc";

interface MoreOptionsDialogProps {
    openDialog: boolean;
    handleCloseDialog: () => void;
    userId: string | undefined;
    fetchProfile: () => void;
    fetchUserPosts: () => void;
    isFollowing: boolean | undefined;
}

function DialogIconWrap({ children, danger = false, muted = false }: { children: React.ReactNode; danger?: boolean; muted?: boolean }) {
    return (
        <View style={[
            styles.iconWrap,
            danger && styles.iconWrapDanger,
            muted && styles.iconWrapMuted,
        ]}>
            {children}
        </View>
    );
}

function DialogBtn({
    icon,
    label,
    onPress,
    danger = false,
    muted = false,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    danger?: boolean;
    muted?: boolean;
}) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.dialogBtn}>
            <DialogIconWrap danger={danger} muted={muted}>{icon}</DialogIconWrap>
            <Text style={[styles.dialogBtnLabel, danger && styles.labelDanger, muted && styles.labelMuted]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function Divider() {
    return <View style={styles.divider} />;
}

export default function MoreOptionsDialog({
    openDialog,
    handleCloseDialog,
    userId,
    fetchProfile,
    fetchUserPosts,
    isFollowing,
}: MoreOptionsDialogProps) {
    const router = useRouter();
    const [currentUser, setCurrentUser] = React.useState<any>(null);

    React.useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    const isOwnProfile = currentUser?.id == userId;

    const handleEditProfile = () => {
        handleCloseDialog();
        router.push("/settings");
    };

    const handleCopyLink = async () => {
        const link = `https://yourapp.com/profile/${userId}`;
        Clipboard.setString(link);
        Alert.alert("Copied!", "Profile link copied to clipboard.");
        handleCloseDialog();
    };

    const handleLogout = async () => {
        socket.disconnect();
        await AsyncStorage.multiRemove(["token", "user", "privateKey"]);
        handleCloseDialog();
        router.replace("/login");
    };

    const handleUnfollow = async () => {
        if (!currentUser?.id || !userId) return;
        try {
            const res = await unfollowUser(currentUser.id, userId);
            if (res.success) {
                handleCloseDialog();
                fetchProfile();
                fetchUserPosts();
            }
        } catch (err) {
            console.error("Unfollow failed:", err);
            Alert.alert("Error", "Failed to unfollow. Please try again.");
        }
    };

    return (
        <Modal visible={openDialog} transparent animationType="fade" onRequestClose={handleCloseDialog}>
            <Pressable style={styles.backdrop} onPress={handleCloseDialog}>
                <Pressable>
                    <View style={styles.card}>
                        {/* User header */}
                        <View style={styles.userHeader}>
                            <Image
                                source={
                                    currentUser?.profile_picture_url
                                        ? { uri: currentUser.profile_picture_url }
                                        : require("../assets/profile_blank.png")
                                }
                                style={styles.userAvatar}
                            />
                            <View>
                                <Text style={styles.userName}>{currentUser?.username || "User"}</Text>
                                <Text style={styles.userSub}>
                                    {isOwnProfile ? "Manage your profile" : "Profile options"}
                                </Text>
                            </View>
                        </View>

                        <Divider />

                        {!isOwnProfile && isFollowing && (
                            <DialogBtn
                                icon={<MaterialIcons name="person-remove" size={17} color="rgba(255,100,100,0.6)" />}
                                label="Unfollow"
                                onPress={handleUnfollow}
                                danger
                            />
                        )}

                        {isOwnProfile && (
                            <DialogBtn
                                icon={<MaterialIcons name="edit" size={17} color="rgba(255,255,255,0.5)" />}
                                label="Edit Profile"
                                onPress={handleEditProfile}
                            />
                        )}

                        <DialogBtn
                            icon={<MaterialIcons name="link" size={17} color="rgba(255,255,255,0.5)" />}
                            label="Copy Profile Link"
                            onPress={handleCopyLink}
                        />

                        {isOwnProfile && (
                            <DialogBtn
                                icon={<Ionicons name="settings-outline" size={17} color="rgba(255,255,255,0.5)" />}
                                label="Settings"
                                onPress={() => { router.push("/settings"); handleCloseDialog(); }}
                            />
                        )}

                        {isOwnProfile && (
                            <DialogBtn
                                icon={<MaterialIcons name="logout" size={17} color="rgba(255,100,100,0.6)" />}
                                label="Log out"
                                onPress={handleLogout}
                                danger
                            />
                        )}

                        <Divider />

                        <DialogBtn
                            icon={<Ionicons name="close" size={17} color="rgba(255,255,255,0.25)" />}
                            label="Cancel"
                            onPress={handleCloseDialog}
                            muted
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
    card: { width: 300, borderRadius: 20, backgroundColor: "#13131c", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 6 },

    userHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
    userAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: ACCENT + "80" },
    userName: { color: "#fff", fontWeight: "600", fontSize: 14.5, lineHeight: 20 },
    userSub: { color: "rgba(255,255,255,0.35)", fontSize: 12 },

    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 8, marginVertical: 4 },

    dialogBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
    iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
    iconWrapDanger: { backgroundColor: "rgba(255,59,48,0.08)" },
    iconWrapMuted: { backgroundColor: "rgba(255,255,255,0.04)" },
    dialogBtnLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
    labelDanger: { color: "rgba(255,100,100,0.85)" },
    labelMuted: { color: "rgba(255,255,255,0.3)" },
});