
// src/utils/authFetch.js

import { useAuth } from "../context/AuthContext";

export const useAuthFetch = () => {
  const { accessToken, refreshAccessToken, logout } = useAuth();

  const authFetch = async (url, options = {}) => {
    let token = accessToken;

    options.headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let response = await fetch(url, options);

    // If access token expired, try to refresh
    if (response.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        if (!newToken) throw new Error("Failed to refresh token");

        options.headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(url, options);
      } catch (err) {
        logout();
        throw new Error("Session expired, please login again");
      }
    }

    return response;
  };

  return authFetch;
};
