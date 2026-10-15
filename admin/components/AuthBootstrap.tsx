"use client";

import { useEffect } from "react";
import { api, setAccessToken, setAuthReady } from "@/lib/api";

const AuthBootstrap = () => {
  useEffect(() => {
    api
      .post("/auth/refresh")
      .then((response) => setAccessToken(response.data.accessToken))
      .catch(() => setAccessToken(null)) // no session; the login form is correct
      .finally(() => setAuthReady());
  }, []);

  return null;
};

export default AuthBootstrap;
