// services/config.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalStore } from "../store/store";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem("token");
    const userId = useGlobalStore.getState().user?.id || "";

    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }

    config.headers["X-CURRENT-USER-ID"] = userId;

    return config;
});

export default api;
