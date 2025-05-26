import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";  // Import axios

const LoginPage = () => {
  const { login, token } = useAuth(); // Get login function and token from AuthContext
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Redirect to dashboard if the user is already logged in
  useEffect(() => {
    if (token) {
      navigate("/dashboard", { replace: true });  // Redirect if token exists
    }
  }, [token, navigate]); // Only run when token changes

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent form reload

    // Check if email and password are provided
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    try {
      const body = new URLSearchParams();
      body.append("username", email); // FastAPI OAuth expects "username"
      body.append("password", password);

      // Make POST request to FastAPI for token using axios
      const response = await axios.post(
        `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/token`,
        body.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      // If login is successful, save the tokens in context and navigate to dashboard
      const data = response.data;
      login(data.access_token, data.refresh_token);
      navigate("/dashboard", { replace: true }); // Redirect to dashboard on successful login
      console.log(localStorage.getItem("token"), " Login");
    } catch (err) {
      // Handle errors (either server-side errors or invalid credentials)
      const errorMessage = err.response?.data?.detail || "Login failed";
      setError(errorMessage);  // Display error message to the user
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-300">
      <div className="bg-white shadow-xl rounded-3xl w-full max-w-md p-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800">Login</h1>
          <p className="text-sm text-gray-500 mt-2">Sign in to your account</p>
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>} {/* Display error message if any */}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              name="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
