import axios from 'axios';

let apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:7071/api';
// apiBaseUrl = "http://192.168.29.15:7071/api";

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const API_BASE_URL = apiBaseUrl;

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
