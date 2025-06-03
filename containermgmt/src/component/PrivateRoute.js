import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
    // console.log(localStorage.getItem("token"));
  if (!token) {
    // console.log("No access token found, redirecting to login page.");
    // If no access token, redirect to login page
    return <Navigate to="/" />;
  }

  // If access token exists, allow the route to render
  return children;
};

export default PrivateRoute;
