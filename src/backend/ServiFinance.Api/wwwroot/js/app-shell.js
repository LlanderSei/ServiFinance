window.serviFinanceTheme = {
    getTheme: function () {
        try {
            return localStorage.getItem('servifinance-theme') || document.documentElement.getAttribute('data-theme') || 'light';
        } catch {
            return document.documentElement.getAttribute('data-theme') || 'light';
        }
    },
    setTheme: function (theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('servifinance-theme', theme);
        } catch {
        }
    }
};
