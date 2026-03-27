export const webSessionStorage = {
  getRefreshToken() {
    return window.localStorage.getItem("sf_refresh_token");
  },
  saveRefreshToken(token: string) {
    window.localStorage.setItem("sf_refresh_token", token);
  },
  clear() {
    window.localStorage.removeItem("sf_refresh_token");
  }
};
