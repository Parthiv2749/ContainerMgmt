import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

// Create Context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken") || null);

  // Login function
  const login = (accessToken, refresh) => {
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refresh);
    setToken(accessToken);
    setRefreshToken(refresh);
    console.log("✅ Login successful");
  };

  // Logout function
  const logout = () => {
    console.log("🚪 Logging out...");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken(null);
    setRefreshToken(null);
  };

  // ✅ Refresh token using Axios (wrapped in useCallback to avoid re-definition on every render)
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return null;

    console.log("🔄 Attempting to refresh access token...");
    try {
      const response = await axios.post(
        `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/refresh`,
        refreshToken ,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      
      const newAccessToken = response.data.access_token;
      localStorage.setItem("token", newAccessToken);
      setToken(newAccessToken);
      console.log("✅ Token refreshed successfully");
      return newAccessToken;
    } catch (err) {
      console.error("❌ Error refreshing token:", err.response?.data || err.message);
      logout();
      return null;
    }
  }, [refreshToken]);

  // Automatically try to refresh token when app loads
  useEffect(() => {
    const tryRefreshOnLoad = async () => {
      if (token) {
        await refreshAccessToken();
      }
    };
    tryRefreshOnLoad();
  }, [token, refreshAccessToken]);

  return (
    <AuthContext.Provider value={{ token, refreshAccessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
