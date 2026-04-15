import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { uploadProfilePicture, updateProfileDetails, getProfile } from "../../services/api";
import { useGlobalStore } from "../../store/store";
import { useThemeColors } from "../../hooks/useThemeColors";

const ACCENT = "#7c5cfc";
const BIO_MAX = 160;

export default function ProfileDetails() {
    const colors = useThemeColors();
    const { setUser } = useGlobalStore();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profileData, setProfileData] = useState<any>(null);
    const [newUsername, setNewUsername] = useState("");
    const [newBio, setNewBio] = useState("");
    const [usernameError, setUsernameError] = useState("");
    const [profileLoading, setProfileLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingPic, setUploadingPic] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [isModified, setIsModified] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    const fetchProfile = useCallback(async () => {
        if (!currentUser?.id) return;
        try {
            setProfileLoading(true);
            const res = await getProfile(currentUser.id);
            setProfileData(res.data);
            setNewUsername(res.data.username);
            setNewBio(res.data.bio ?? "");
        } catch (e) {
            console.error(e);
        } finally {
            setProfileLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        if (profileData) {
            setIsModified(newUsername !== profileData.username || newBio !== (profileData.bio ?? ""));
            setSaveSuccess(false);
            setSaveError("");
        }
    }, [newUsername, newBio, profileData]);

    const pickAndUploadPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
        });
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        setUploadingPic(true);
        try {
            const file = { uri: asset.uri, name: "profile.jpg", type: "image/jpeg" } as any;
            const response = await uploadProfilePicture(currentUser.id, file);
            const updatedUser = { ...currentUser, profile_picture_url: response.fileUrl };
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
            setCurrentUser(updatedUser);
            Alert.alert("Success", "Profile picture updated!");
        } catch (e) {
            Alert.alert("Error", "Failed to upload photo.");
        } finally {
            setUploadingPic(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser?.id || !isModified || usernameError) return;
        setSaving(true);
        setSaveSuccess(false);
        setSaveError("");
        try {
            await updateProfileDetails({ username: newUsername, bio: newBio });
            const updatedUser = { ...currentUser, username: newUsername };
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
            setCurrentUser(updatedUser);
            setProfileData((p: any) => (p ? { ...p, username: newUsername, bio: newBio } : p));
            setSaveSuccess(true);
        } catch (e: any) {
            setSaveError(e?.response?.data?.error || "Something went wrong.");
        } finally {
            setSaving(false);
        }
    };

    if (profileLoading) {
        return (
            <View style={styles.loadingWrap}>
                <View style={[styles.avatarSkeleton, { backgroundColor: colors.hover }]} />
                <View style={{ gap: 10, width: "100%" }}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={[styles.lineSkeleton, { backgroundColor: colors.hover, width: i === 3 ? "60%" : "100%" }]} />
                    ))}
                </View>
            </View>
        );
    }

    const bioLen = newBio?.length ?? 0;
    const bioNearLimit = bioLen >= BIO_MAX * 0.85;
    const bioAtLimit = bioLen >= BIO_MAX;

    return (
        <View style={styles.root}>
            {/* ── Header ── */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profile details</Text>
                <Text style={[styles.sectionSub, { color: colors.textDisabled }]}>Manage your public-facing identity</Text>
            </View>

            {/* ── Avatar card ── */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.avatarRow}>
                    <TouchableOpacity onPress={pickAndUploadPhoto} activeOpacity={0.8} style={styles.avatarWrap}>
                        <Image
                            source={
                                currentUser?.profile_picture_url
                                    ? { uri: currentUser.profile_picture_url }
                                    : require("../../assets/profile_blank.png")
                            }
                            style={styles.avatar}
                        />
                        <View style={styles.avatarOverlay}>
                            {uploadingPic ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={16} color="#fff" />}
                        </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.avatarName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {newUsername || "—"}
                        </Text>
                        <Text style={[styles.avatarHint, { color: colors.textDisabled }]}>Tap photo to change it</Text>
                    </View>
                    <TouchableOpacity
                        onPress={pickAndUploadPhoto}
                        activeOpacity={0.7}
                        style={[styles.changePhotoBtn, { borderColor: colors.border }]}
                    >
                        <Text style={[styles.changePhotoBtnText, { color: colors.textSecondary }]}>Change photo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Form card ── */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Username */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textDisabled }]}>USERNAME</Text>
                    <View style={[styles.input, { backgroundColor: colors.hover, borderColor: usernameError ? "#e53935" : colors.border }]}>
                        <TextInput
                            value={newUsername}
                            onChangeText={(v) => {
                                setNewUsername(v);
                                setUsernameError(
                                    !v ? "Username cannot be empty." : /^[a-zA-Z0-9_]+$/.test(v) ? "" : "Only letters, numbers, and underscores.",
                                );
                            }}
                            style={[styles.inputText, { color: colors.textPrimary }]}
                            placeholderTextColor={colors.textDisabled}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                    {!!usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
                </View>

                {/* Bio */}
                <View style={[styles.fieldWrap, { marginTop: 16 }]}>
                    <View style={styles.fieldLabelRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textDisabled }]}>BIO</Text>
                        <Text style={[styles.charCount, { color: bioAtLimit ? "#e53935" : bioNearLimit ? "#f59e0b" : colors.textDisabled }]}>
                            {bioLen} / {BIO_MAX}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.input,
                            styles.bioInput,
                            { backgroundColor: colors.hover, borderColor: bioAtLimit ? "#e53935" : colors.border },
                        ]}
                    >
                        <TextInput
                            value={newBio}
                            onChangeText={setNewBio}
                            multiline
                            maxLength={BIO_MAX}
                            style={[styles.inputText, styles.bioText, { color: colors.textPrimary }]}
                            placeholderTextColor={colors.textDisabled}
                            placeholder="Write something about yourself…"
                        />
                    </View>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Status banners */}
                {!!saveError && (
                    <View style={[styles.banner, styles.errorBanner]}>
                        <Ionicons name="alert-circle-outline" size={15} color="#e53935" />
                        <Text style={styles.bannerErrorText}>{saveError}</Text>
                    </View>
                )}
                {saveSuccess && !saveError && (
                    <View style={[styles.banner, styles.successBanner]}>
                        <Ionicons name="checkmark-circle-outline" size={15} color="#22c55e" />
                        <Text style={styles.bannerSuccessText}>Your profile has been updated.</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={[styles.cardFooter, { backgroundColor: colors.hover }]}>
                    {isModified && !saving && <Text style={[styles.unsavedText, { color: colors.textDisabled }]}>Unsaved changes</Text>}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!isModified || saving || !!usernameError}
                        activeOpacity={0.85}
                        style={[styles.saveBtn, { backgroundColor: ACCENT, opacity: !isModified || !!usernameError ? 0.4 : 1 }]}
                    >
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { gap: 16 },
    loadingWrap: { gap: 16, alignItems: "center", paddingTop: 8 },
    avatarSkeleton: { width: 64, height: 64, borderRadius: 32 },
    lineSkeleton: { height: 14, borderRadius: 7 },

    sectionHeader: { gap: 3 },
    sectionTitle: { fontWeight: "500", fontSize: 16, letterSpacing: -0.2 },
    sectionSub: { fontSize: 13 },

    card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },

    avatarRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    avatarWrap: { position: "relative", flexShrink: 0 },
    avatar: { width: 58, height: 58, borderRadius: 29 },
    avatarOverlay: {
        position: "absolute",
        inset: 0,
        borderRadius: 29,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarName: { fontWeight: "500", fontSize: 14 },
    avatarHint: { fontSize: 12, marginTop: 2 },
    changePhotoBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
    changePhotoBtnText: { fontSize: 12.5, fontWeight: "500" },

    fieldWrap: { paddingHorizontal: 16, paddingTop: 16 },
    fieldLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    fieldLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 0.8, marginBottom: 8 },
    charCount: { fontSize: 11 },
    input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
    bioInput: { paddingTop: 12 },
    inputText: { fontSize: 14 },
    bioText: { minHeight: 72, textAlignVertical: "top" },
    errorText: { color: "#e53935", fontSize: 12, marginTop: 5 },

    divider: { height: 1, marginTop: 16 },

    banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    errorBanner: { backgroundColor: "rgba(229,57,53,0.08)", borderColor: "rgba(229,57,53,0.3)" },
    successBanner: { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" },
    bannerErrorText: { color: "#e53935", fontSize: 13 },
    bannerSuccessText: { color: "#22c55e", fontSize: 13 },

    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 12,
    },
    unsavedText: { fontSize: 12, flex: 1 },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, minWidth: 120, alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "500", fontSize: 14 },
});
